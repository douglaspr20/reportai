import type { QueryConfig } from "pg";
import { z } from "zod";
import { readOnlyPool } from "@/lib/db";
import { chatCompletion, getApiKey, getChatModel, type Message } from "@/lib/openrouter";

export const MAX_ROWS = 100;

/** La consulta generada no se pudo ejecutar; el mensaje es el error de Postgres. */
export class SqlExecutionError extends Error {}

const Plan = z.object({
  modo: z.enum(["sql", "semantica"]),
  sql: z
    .string()
    .nullable()
    .describe("Una única consulta SELECT de PostgreSQL si modo es 'sql'; si no, null"),
});

export type Plan = z.infer<typeof Plan>;

const { $schema: _ignored, ...PLAN_SCHEMA } = z.toJSONSchema(Plan) as Record<string, unknown>;

const SCHEMA_DESCRIPTION = `
document_fields     -- una fila por documento guardado
  document_id bigint, tipo_documento text ('factura' | 'recibo' | 'contrato' | 'otro'),
  confianza real, idioma text, resumen text, numero_documento text,
  fecha_emision date, fecha_vencimiento date, moneda text (ISO 4217: 'EUR', 'USD'…),
  subtotal numeric, impuestos_total numeric, total numeric, metodo_pago text,
  vigencia_inicio date, vigencia_fin date   -- vigencia solo en contratos

document_parties    -- emisor, receptor y partes de contratos
  document_id bigint, rol text ('emisor' | 'receptor' | 'parte'), posicion int,
  nombre text, identificacion_fiscal text, direccion text

document_lines      -- líneas de detalle de facturas y recibos
  document_id bigint, posicion int, descripcion text,
  cantidad numeric, precio_unitario numeric, importe numeric

document_taxes      -- desglose de impuestos
  document_id bigint, posicion int, concepto text ('IVA', 'IRPF'…),
  porcentaje numeric, base_imponible numeric, importe numeric

document_clauses    -- cláusulas clave de contratos
  document_id bigint, posicion int, texto text

documents           -- metadatos del archivo (solo estas columnas son legibles)
  id bigint, filename text, mime_type text, size_bytes bigint,
  status text, created_at timestamptz, confirmed_at timestamptz`;

function plannerPrompt(today: string) {
  return `Decides cómo responder una pregunta sobre los documentos guardados de un
usuario (facturas, recibos, contratos). Hay dos modos:

- "sql": la pregunta pide cálculos o datos agregados sobre varios documentos:
  totales, sumas, medias, recuentos, máximos/mínimos, rankings, comparaciones,
  o listados filtrados por fecha, importe, tipo, emisor, etc.
  Ejemplos: "¿cuánto he gastado en marzo?", "¿cuántas facturas tengo de X?",
  "¿cuál es la factura más cara?", "lista los recibos pagados con tarjeta",
  "IVA total del trimestre".
- "semantica": la pregunta es sobre el contenido de un documento concreto o
  sobre texto libre: qué dice una cláusula, qué se compró, condiciones,
  datos de contacto… Ante la duda entre ambos, elige "semantica".

Si eliges "sql", escribe UNA consulta de PostgreSQL 17 sobre estas tablas
(solo documentos ya guardados; no hay más tablas accesibles):
${SCHEMA_DESCRIPTION}

Reglas del SQL:
- Una sola sentencia SELECT (se permite WITH). Sin punto y coma ni comentarios.
- Incluye SIEMPRE una columna document_ids (bigint[]) con los ids de los
  documentos de los que sale cada fila: array_agg(DISTINCT f.document_id) en
  agregados, ARRAY[f.document_id] en filas sueltas.
- Al sumar o promediar importes, agrupa por moneda: no mezcles divisas.
- Para nombres usa ILIKE con comodines (p. ej. nombre ILIKE '%marmolejo%').
- Para periodos usa fecha_emision. Hoy es ${today}; "este mes", "el año
  pasado", etc. se calculan a partir de esa fecha.
- Si devuelves filas sueltas, ordénalas de forma útil y limita a ${MAX_ROWS}.
- Da a las columnas calculadas nombres claros en español (total_gastado, num_facturas…).

Responde solo con el JSON del esquema.`;
}

/**
 * Decide si la última pregunta se responde con SQL o con búsqueda semántica y,
 * si es SQL, genera la consulta. `previousError` sirve para pedir una
 * corrección cuando la consulta anterior falló al ejecutarse.
 */
export async function planQuestion(
  history: { role: "user" | "assistant"; content: string }[],
  previousError?: { sql: string; error: string }
): Promise<Plan> {
  const today = new Date().toISOString().slice(0, 10);
  const messages: Message[] = [
    { role: "system", content: plannerPrompt(today) },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
  ];

  if (previousError) {
    messages.push(
      { role: "assistant", content: JSON.stringify({ modo: "sql", sql: previousError.sql }) },
      {
        role: "user",
        content: `La consulta falló en Postgres: ${previousError.error}\nCorrígela respetando las reglas.`,
      }
    );
  }

  const { content } = await chatCompletion(getApiKey(), getChatModel(), messages, {
    maxTokens: 1500,
    responseFormat: {
      type: "json_schema",
      json_schema: { name: "plan_consulta", strict: true, schema: PLAN_SCHEMA },
    },
  });

  const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  const plan = Plan.parse(JSON.parse(text));
  // Un "sql" sin consulta no se puede ejecutar: mejor la búsqueda semántica.
  return plan.modo === "sql" && plan.sql?.trim() ? plan : { modo: "semantica", sql: null };
}

/**
 * Ejecuta SQL generado por el modelo. La seguridad no depende de revisar el
 * texto sino de dónde se ejecuta:
 * - con el rol reportai_reader, que solo tiene SELECT sobre las tablas
 *   estructuradas y no puede cambiar de rol;
 * - en una transacción READ ONLY con timeout que siempre se deshace, lo que
 *   revierte también cualquier set_config() que intente la consulta;
 * - envuelta en un subselect por el protocolo extendido, que no admite varias
 *   sentencias, y con un LIMIT que acota el tamaño del resultado.
 */
export async function runReadOnlyQuery(sql: string) {
  const clean = sql.trim().replace(/;\s*$/, "");
  if (!/^(select|with)\b/i.test(clean)) {
    throw new SqlExecutionError("La consulta no empieza por SELECT o WITH.");
  }

  const client = await readOnlyPool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '5s'");
    // El salto de línea antes del paréntesis evita que un "--" final lo comente.
    const config = {
      text: `SELECT * FROM (\n${clean}\n) AS consulta LIMIT ${MAX_ROWS + 1}`,
      queryMode: "extended",
    } as QueryConfig;
    const result = await client.query<Record<string, unknown>>(config);
    return {
      rows: result.rows.slice(0, MAX_ROWS),
      truncated: result.rows.length > MAX_ROWS,
    };
  } catch (error) {
    throw new SqlExecutionError((error as Error).message);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
}
