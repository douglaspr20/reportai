import { z } from "zod";
import {
  OpenRouterError,
  chatCompletion,
  getApiKey,
  getChatModel,
  type ContentPart,
  type Message,
} from "@/lib/openrouter";
import { MAX_PDF_PAGES, renderPdfToImages } from "@/lib/pdf";

/**
 * Esquema de extracción. Todos los campos específicos son nullable en vez de
 * opcionales: así el modelo siempre devuelve la misma forma y marca con null lo
 * que no aplica al tipo de documento (p. ej. `total` en un contrato).
 *
 * Ojo: `strict: true` en el json_schema es una pista fuerte, pero OpenRouter no
 * lo impone en todos los proveedores — DeepSeek se desvía del esquema en
 * documentos ricos. Por eso la respuesta se valida siempre con Zod y, si falla,
 * se pide una corrección (ver `repairPrompt`).
 */
const Parte = z.object({
  nombre: z.string().nullable(),
  identificacion_fiscal: z
    .string()
    .nullable()
    .describe("Solo el número fiscal como texto, p. ej. 'B-84213977'"),
  direccion: z.string().nullable(),
});

const Linea = z.object({
  descripcion: z.string(),
  cantidad: z.number().nullable(),
  precio_unitario: z.number().nullable(),
  importe: z.number().nullable(),
});

const Impuesto = z.object({
  concepto: z.string().describe("Nombre del impuesto, p. ej. 'IVA' o 'IRPF'"),
  porcentaje: z.number().nullable(),
  base_imponible: z.number().nullable(),
  importe: z.number().nullable(),
});

export const AnalysisSchema = z.object({
  tipo_documento: z.enum(["factura", "recibo", "contrato", "otro"]),
  confianza: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Seguridad de la clasificación como decimal entre 0 y 1 (0.95 = muy seguro). Si has podido clasificar el documento, nunca es 0"
    ),
  idioma: z.string().nullable(),
  resumen: z.string().describe("Una frase describiendo el documento"),

  // Comunes a factura / recibo
  numero_documento: z.string().nullable(),
  fecha_emision: z.string().nullable().describe("ISO 8601 (YYYY-MM-DD)"),
  fecha_vencimiento: z.string().nullable().describe("ISO 8601 (YYYY-MM-DD)"),
  emisor: Parte.nullable(),
  receptor: Parte.nullable(),
  moneda: z.string().nullable().describe("Código ISO 4217, p. ej. EUR o USD"),
  subtotal: z.number().nullable().describe("Base imponible, un único número"),
  impuestos_total: z
    .number()
    .nullable()
    .describe(
      "UN SOLO número: la suma de todos los impuestos. El desglose va en impuestos_detalle, nunca aquí"
    ),
  impuestos_detalle: z
    .array(Impuesto)
    .describe("Un elemento por cada impuesto desglosado; vacío si no hay desglose"),
  total: z.number().nullable().describe("Importe final a pagar, un único número"),
  metodo_pago: z.string().nullable(),
  lineas: z.array(Linea).describe("Vacío si el documento no tiene detalle de líneas"),

  // Específicos de contrato
  partes_contrato: z
    .array(z.string())
    .describe("Solo si tipo_documento es 'contrato'; en otro caso, vacío"),
  vigencia_inicio: z
    .string()
    .nullable()
    .describe("Solo si tipo_documento es 'contrato'; en otro caso, null"),
  vigencia_fin: z
    .string()
    .nullable()
    .describe("Solo si tipo_documento es 'contrato'; en otro caso, null"),
  clausulas_clave: z
    .array(z.string())
    .describe("Solo si tipo_documento es 'contrato'; en otro caso, vacío"),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

// zod ya emite `required` completo y additionalProperties:false, que es justo
// lo que pide el modo strict. Solo sobra la clave $schema.
const { $schema: _ignored, ...JSON_SCHEMA } = z.toJSONSchema(AnalysisSchema) as Record<
  string,
  unknown
>;

const SYSTEM_PROMPT = `Eres un extractor de datos de documentos administrativos.

Clasifica el documento como "factura", "recibo", "contrato" u "otro":
- factura: documento fiscal que reclama un pago (tiene número de factura, emisor, receptor, impuestos).
- recibo: comprobante de un pago ya realizado (ticket de compra, justificante).
- contrato: acuerdo entre partes con cláusulas y vigencia.
- otro: cualquier cosa que no encaje en las anteriores.

Extrae los campos que aparezcan realmente en el documento. Deja en null lo que
no aparezca y no inventes valores: si un importe no es legible, es null.
Los importes van como número, sin símbolo de moneda ni separadores de millar
(2.737,00 € -> 2737.00). Las fechas en ISO 8601 (YYYY-MM-DD).

Respeta el tipo de cada campo del esquema al pie de la letra: donde pide un
número devuelve un número, y donde pide texto devuelve texto — nunca un objeto
ni una lista en su lugar. Responde únicamente con el JSON del esquema.`;

export class AnalysisError extends OpenRouterError {}

const TRANSCRIBE_PROMPT = `Transcribe literalmente todo el texto visible del
documento, en orden de lectura. No resumas, no traduzcas ni añadas comentarios.
Separa las páginas con una línea en blanco. En las tablas, escribe una fila por
línea con las celdas separadas por " | ". Responde solo con el texto.`;

// Un PDF con menos caracteres útiles por página se considera escaneado y su
// texto se transcribe con el modelo en vez de leer la capa de texto.
const MIN_TEXT_CHARS_PER_PAGE = 40;

export type AnalysisResult = {
  analysis: Analysis;
  /** Texto completo del documento, para los embeddings. null si no se pudo obtener. */
  text: string | null;
  model: string;
  /** true si hizo falta una segunda llamada para corregir la forma del JSON. */
  repaired: boolean;
  warnings: string[];
};

export async function analyzeDocument(
  data: Buffer,
  mimeType: string
): Promise<AnalysisResult> {
  const apiKey = getApiKey();
  const model = getChatModel();
  const warnings: string[] = [];

  // Un PDF se convierte en una imagen por página; una imagen va tal cual.
  let images: { buffer: Buffer; mimeType: string }[];
  let layerText: string | null = null;
  if (mimeType === "application/pdf") {
    const rendered = await renderPdfToImages(data);
    if (rendered.pages.length === 0) {
      throw new AnalysisError("El PDF no tiene páginas legibles.");
    }
    if (rendered.truncated) {
      warnings.push(
        `El PDF tiene ${rendered.totalPages} páginas; solo se han analizado las ${MAX_PDF_PAGES} primeras.`
      );
    }
    images = rendered.pages.map((buffer) => ({ buffer, mimeType: "image/png" }));
    const usefulChars = rendered.text.replace(/\s/g, "").length;
    if (usefulChars >= MIN_TEXT_CHARS_PER_PAGE * rendered.pages.length) {
      layerText = rendered.text;
    }
  } else {
    images = [{ buffer: data, mimeType }];
  }

  const imageParts = images.map(
    (image): ContentPart => ({
      type: "image_url",
      image_url: {
        url: `data:${image.mimeType};base64,${image.buffer.toString("base64")}`,
      },
    })
  );

  // La transcripción va en paralelo con la extracción; si falla, el documento
  // se puede guardar igual y se indexa a partir de los datos extraídos.
  const [extracted, text] = await Promise.all([
    extract(apiKey, model, imageParts),
    layerText ??
      transcribe(apiKey, model, imageParts).catch((error: Error) => {
        console.warn("[analysis] transcripción fallida:", error);
        warnings.push(
          "No se pudo transcribir el texto del documento; al guardarlo se indexarán solo los datos extraídos."
        );
        return null;
      }),
  ]);

  return { ...extracted, text, warnings };
}

async function extract(apiKey: string, model: string, imageParts: ContentPart[]) {
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: "Clasifica este documento y extrae sus datos." },
        ...imageParts,
      ],
    },
  ];

  const first = await complete(apiKey, model, messages, { schema: true });
  const parsed = AnalysisSchema.safeParse(toJson(first.content));

  if (parsed.success) {
    return { analysis: parsed.data, model: first.model, repaired: false };
  }

  // El modelo se desvió del esquema: le devolvemos los errores concretos para
  // que reformatee lo que ya extrajo, sin volver a mirar el documento.
  console.warn(`[analysis] esquema incumplido, reintentando:\n${describe(parsed.error)}`);

  const retry = await complete(
    apiKey,
    model,
    [
      ...messages,
      { role: "assistant", content: first.content },
      { role: "user", content: repairPrompt(parsed.error) },
    ],
    { schema: true }
  );

  const repaired = AnalysisSchema.safeParse(toJson(retry.content));
  if (!repaired.success) {
    throw new AnalysisError(
      `El modelo no respetó el esquema ni tras corregirlo: ${describe(repaired.error)}`
    );
  }

  return { analysis: repaired.data, model: retry.model, repaired: true };
}

async function transcribe(apiKey: string, model: string, imageParts: ContentPart[]) {
  const { content } = await complete(
    apiKey,
    model,
    [
      { role: "system", content: TRANSCRIBE_PROMPT },
      {
        role: "user",
        content: [{ type: "text", text: "Transcribe este documento." }, ...imageParts],
      },
    ],
    // Un documento de 8 páginas densas ronda los 15k tokens de salida.
    { schema: false, maxTokens: 16_000 }
  );
  return stripCodeFence(content);
}

function repairPrompt(error: z.ZodError) {
  return `Tu JSON no cumple el esquema:
${describe(error)}

Devuelve el mismo contenido corregido, respetando el tipo de cada campo. No
vuelvas a leer el documento ni cambies los valores extraídos: solo la forma.`;
}

function describe(error: z.ZodError) {
  return error.issues
    .map((issue) => `- ${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
    .join("\n");
}

function complete(
  apiKey: string,
  model: string,
  messages: Message[],
  options: { schema: boolean; maxTokens?: number }
) {
  return chatCompletion(apiKey, model, messages, {
    maxTokens: options.maxTokens,
    responseFormat: options.schema
      ? {
          type: "json_schema",
          json_schema: { name: "analisis_documento", strict: true, schema: JSON_SCHEMA },
        }
      : undefined,
  });
}

function toJson(raw: string): unknown {
  const text = stripCodeFence(raw);
  try {
    return JSON.parse(text);
  } catch {
    throw new AnalysisError(`El modelo no devolvió JSON válido: ${text.slice(0, 200)}`);
  }
}

/** Algunos modelos envuelven el JSON en ```json … ``` pese al schema. */
function stripCodeFence(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}
