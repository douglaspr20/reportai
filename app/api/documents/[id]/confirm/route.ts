import { NextResponse } from "next/server";
import { DocumentError, confirmDocument } from "@/lib/documents";
import { EmbeddingError } from "@/lib/embeddings";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Id no válido." }, { status: 400 });
  }

  try {
    return NextResponse.json(await confirmDocument(id));
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof EmbeddingError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("[confirm] no se pudo guardar:", error);
    return NextResponse.json(
      { error: `No se pudo guardar en Postgres: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
