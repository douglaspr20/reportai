import { NextResponse } from "next/server";
import { listDocuments } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ documents: await listDocuments() });
  } catch (error) {
    console.error("[documents] no se pudo listar:", error);
    return NextResponse.json(
      { error: "No se pudo leer la lista de documentos. ¿Está Postgres arrancado?" },
      { status: 503 }
    );
  }
}
