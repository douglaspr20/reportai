import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [row] = await query<{ extversion: string | null }>(
      `SELECT extversion FROM pg_extension WHERE extname = 'vector'`
    );
    return NextResponse.json({
      database: "ok",
      pgvector: row?.extversion ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { database: "down", error: (error as Error).message },
      { status: 503 }
    );
  }
}
