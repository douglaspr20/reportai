import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { analyzeDocument } from "@/lib/analysis";
import { query } from "@/lib/db";
import { UPLOAD_DIR } from "@/lib/documents";
import { OpenRouterError } from "@/lib/openrouter";
import { MAX_FILE_SIZE, isAccepted } from "@/lib/files";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No se recibió ningún archivo." },
      { status: 400 }
    );
  }

  if (!isAccepted(file.type)) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido: ${file.type || "desconocido"}.` },
      { status: 415 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 25 MB." },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storedName = `${randomUUID()}${path.extname(file.name)}`;
  const storedPath = path.join(UPLOAD_DIR, storedName);

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(storedPath, buffer);

  let result;
  try {
    result = await analyzeDocument(buffer, file.type);
  } catch (error) {
    // Sin análisis no hay fila en la base: borramos el archivo para no dejar huérfanos.
    await unlink(storedPath).catch(() => {});
    const message =
      error instanceof OpenRouterError
        ? error.message
        : `Fallo inesperado al analizar: ${(error as Error).message}`;
    console.error("[upload] análisis fallido:", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { analysis, text, model, repaired } = result;
  const warnings = [...result.warnings];
  let id: string | null = null;

  try {
    // Queda 'pendiente': las tablas y los embeddings se rellenan al confirmar.
    const [row] = await query<{ id: string }>(
      `INSERT INTO documents
         (filename, stored_name, mime_type, size_bytes, doc_type, analysis, model, content_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        file.name,
        storedName,
        file.type,
        file.size,
        analysis.tipo_documento,
        JSON.stringify(analysis),
        model,
        text,
      ]
    );
    id = row.id;
  } catch (error) {
    // El análisis ya está hecho: avisamos pero devolvemos el JSON igualmente.
    console.error("[upload] no se pudo guardar en Postgres:", error);
    warnings.push(
      "Postgres no respondió, así que este análisis no se podrá guardar. Arranca la base con `npm run db:up` y vuelve a subirlo."
    );
  }

  return NextResponse.json({ id, storedName, analysis, model, repaired, warnings });
}
