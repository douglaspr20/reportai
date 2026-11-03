import { unlink } from "node:fs/promises";
import path from "node:path";
import { AnalysisSchema, type Analysis } from "@/lib/analysis";
import { pool, query } from "@/lib/db";
import { chunkText, embedTexts, toVectorLiteral } from "@/lib/embeddings";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

/** Errores esperables (documento inexistente, ya confirmado…) con su código HTTP. */
export class DocumentError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export type SavedDocument = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: string;
  confirmed_at: string;
  tipo_documento: Analysis["tipo_documento"];
  resumen: string | null;
  numero_documento: string | null;
  fecha_emision: string | null;
  /** NUMERIC llega como texto para no perder precisión. */
  total: string | null;
  moneda: string | null;
  /** Partes del contrato separadas por " · "; si no hay, el emisor. */
  partes: string | null;
  chunks: number;
};

export async function listDocuments(limit = 100) {
  return query<SavedDocument>(
    `SELECT d.id, d.filename, d.mime_type, d.size_bytes, d.confirmed_at,
            f.tipo_documento, f.resumen, f.numero_documento,
            f.fecha_emision::text AS fecha_emision, f.total::text AS total, f.moneda,
            COALESCE(
              (SELECT string_agg(p.nombre, ' · ' ORDER BY p.posicion)
                 FROM document_parties p WHERE p.document_id = d.id AND p.rol = 'parte'),
              (SELECT p.nombre
                 FROM document_parties p WHERE p.document_id = d.id AND p.rol = 'emisor' LIMIT 1)
            ) AS partes,
            (SELECT count(*)::int FROM document_chunks c WHERE c.document_id = d.id) AS chunks
       FROM documents d
       JOIN document_fields f ON f.document_id = d.id
      WHERE d.status = 'confirmado'
      ORDER BY d.confirmed_at DESC
      LIMIT $1`,
    [limit]
  );
}

/**
 * Pasa un documento de 'pendiente' a 'confirmado': reparte el análisis en las
 * tablas estructuradas y guarda su texto troceado con embeddings. Todo va en
 * una transacción; los embeddings se piden antes para no tenerla abierta
 * mientras se espera a la red.
 */
export async function confirmDocument(id: string) {
  const [doc] = await query<{ status: string; analysis: unknown; content_text: string | null }>(
    `SELECT status, analysis, content_text FROM documents WHERE id = $1`,
    [id]
  );
  if (!doc) throw new DocumentError("El documento no existe.", 404);
  if (doc.status === "confirmado") throw new DocumentError("El documento ya está guardado.", 409);

  const parsed = AnalysisSchema.safeParse(doc.analysis);
  if (!parsed.success) {
    throw new DocumentError("El análisis guardado no es válido; vuelve a subir el archivo.", 422);
  }
  const analysis = parsed.data;

  // El esquema reserva estos campos a los contratos, pero el modelo a veces los
  // rellena en facturas copiando emisor/receptor y fechas. No los guardamos.
  if (analysis.tipo_documento !== "contrato") {
    analysis.partes_contrato = [];
    analysis.clausulas_clave = [];
    analysis.vigencia_inicio = null;
    analysis.vigencia_fin = null;
  }

  // Sin transcripción, indexamos al menos lo extraído para que sea localizable.
  const text = doc.content_text?.trim() || analysisAsText(analysis);
  const chunks = chunkText(text);
  const { embeddings, model: embeddingModel } = await embedTexts(chunks);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // El FOR UPDATE evita que dos confirmaciones simultáneas dupliquen filas.
    const lock = await client.query(
      `SELECT 1 FROM documents WHERE id = $1 AND status = 'pendiente' FOR UPDATE`,
      [id]
    );
    if (lock.rowCount === 0) throw new DocumentError("El documento ya está guardado.", 409);

    await client.query(
      `INSERT INTO document_fields (
         document_id, tipo_documento, confianza, idioma, resumen, numero_documento,
         fecha_emision, fecha_vencimiento, moneda, subtotal, impuestos_total, total,
         metodo_pago, vigencia_inicio, vigencia_fin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id,
        analysis.tipo_documento,
        analysis.confianza,
        analysis.idioma,
        analysis.resumen,
        analysis.numero_documento,
        toDate(analysis.fecha_emision),
        toDate(analysis.fecha_vencimiento),
        analysis.moneda,
        analysis.subtotal,
        analysis.impuestos_total,
        analysis.total,
        analysis.metodo_pago,
        toDate(analysis.vigencia_inicio),
        toDate(analysis.vigencia_fin),
      ]
    );

    const parties = [
      ...(analysis.emisor ? [{ rol: "emisor", ...analysis.emisor }] : []),
      ...(analysis.receptor ? [{ rol: "receptor", ...analysis.receptor }] : []),
      ...analysis.partes_contrato.map((nombre) => ({
        rol: "parte",
        nombre,
        identificacion_fiscal: null,
        direccion: null,
      })),
    ].filter((party) => party.nombre || party.identificacion_fiscal || party.direccion);
    for (const [posicion, party] of parties.entries()) {
      await client.query(
        `INSERT INTO document_parties
           (document_id, rol, posicion, nombre, identificacion_fiscal, direccion)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, party.rol, posicion, party.nombre, party.identificacion_fiscal, party.direccion]
      );
    }

    for (const [posicion, line] of analysis.lineas.entries()) {
      await client.query(
        `INSERT INTO document_lines
           (document_id, posicion, descripcion, cantidad, precio_unitario, importe)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, posicion, line.descripcion, line.cantidad, line.precio_unitario, line.importe]
      );
    }

    for (const [posicion, tax] of analysis.impuestos_detalle.entries()) {
      await client.query(
        `INSERT INTO document_taxes
           (document_id, posicion, concepto, porcentaje, base_imponible, importe)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, posicion, tax.concepto, tax.porcentaje, tax.base_imponible, tax.importe]
      );
    }

    for (const [posicion, texto] of analysis.clausulas_clave.entries()) {
      await client.query(
        `INSERT INTO document_clauses (document_id, posicion, texto) VALUES ($1, $2, $3)`,
        [id, posicion, texto]
      );
    }

    for (const [index, content] of chunks.entries()) {
      await client.query(
        `INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [id, index, content, toVectorLiteral(embeddings[index])]
      );
    }

    await client.query(
      `UPDATE documents
          SET status = 'confirmado', confirmed_at = now(), embedding_model = $2
        WHERE id = $1`,
      [id, embeddingModel]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return { id, chunks: chunks.length, embeddingModel };
}

/** Borra un documento aún sin confirmar y su archivo. Los confirmados no se tocan. */
export async function discardDocument(id: string) {
  const [row] = await query<{ stored_name: string }>(
    `DELETE FROM documents WHERE id = $1 AND status = 'pendiente' RETURNING stored_name`,
    [id]
  );
  if (!row) throw new DocumentError("No hay un documento pendiente con ese id.", 404);
  await unlink(path.join(UPLOAD_DIR, row.stored_name)).catch(() => {});
}

/** El modelo devuelve fechas como texto; solo pasan las ISO que existen de verdad. */
function toDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : null;
}

function analysisAsText(analysis: Analysis) {
  return `${analysis.resumen}\n\n${JSON.stringify(analysis, null, 2)}`;
}
