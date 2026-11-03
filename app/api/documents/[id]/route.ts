import { NextResponse } from "next/server";
import { DocumentError, discardDocument } from "@/lib/documents";

export const runtime = "nodejs";

/** Descarta un análisis que el usuario no ha llegado a confirmar. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Id no válido." }, { status: 400 });
  }

  try {
    await discardDocument(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[documents] no se pudo descartar:", error);
    return NextResponse.json({ error: "No se pudo descartar el documento." }, { status: 500 });
  }
}
