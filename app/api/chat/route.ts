import { NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion } from "@/lib/chat";
import { EmbeddingError } from "@/lib/embeddings";
import { OpenRouterError } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      })
    )
    .min(1)
    .max(40)
    .refine((messages) => messages[messages.length - 1].role === "user", {
      message: "El último mensaje tiene que ser del usuario.",
    }),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Petición no válida." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await answerQuestion(parsed.data.messages));
  } catch (error) {
    if (error instanceof OpenRouterError || error instanceof EmbeddingError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("[chat] fallo al responder:", error);
    return NextResponse.json(
      { error: "No se pudo consultar la base de datos. ¿Está Postgres arrancado?" },
      { status: 503 }
    );
  }
}
