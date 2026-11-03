import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { UPLOAD_DIR } from "@/lib/documents";

export const runtime = "nodejs";

/** Sirve el archivo original de un documento guardado, para abrirlo desde una cita. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Id no válido." }, { status: 400 });
  }

  const [doc] = await query<{ filename: string; stored_name: string; mime_type: string }>(
    `SELECT filename, stored_name, mime_type FROM documents
      WHERE id = $1 AND status = 'confirmado'`,
    [id]
  );
  if (!doc) {
    return NextResponse.json({ error: "El documento no existe." }, { status: 404 });
  }

  let data: Buffer;
  try {
    // stored_name lo genera el servidor (UUID + extensión); basename por si acaso.
    data = await readFile(path.join(UPLOAD_DIR, path.basename(doc.stored_name)));
  } catch {
    return NextResponse.json(
      { error: "El archivo ya no está en el disco." },
      { status: 404 }
    );
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
