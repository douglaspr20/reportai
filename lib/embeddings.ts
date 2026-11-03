const OPENROUTER_URL = "https://openrouter.ai/api/v1/embeddings";
export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

/** Tiene que coincidir con `vector(1536)` en document_chunks. */
export const EMBEDDING_DIMENSIONS = 1536;

// ~350 tokens por fragmento: suficiente contexto para una cláusula o un bloque
// de líneas de factura sin diluir el significado del embedding.
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;
const BATCH_SIZE = 64;

export class EmbeddingError extends Error {}

/**
 * Parte el texto en fragmentos de hasta `size` caracteres que se solapan
 * `overlap`. Corta preferentemente en un salto de párrafo, de línea, final de
 * frase o espacio, siempre que caiga en la segunda mitad del fragmento.
 */
export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const clean = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);

    if (end < clean.length) {
      const window = clean.slice(start, end);
      for (const separator of ["\n\n", "\n", ". ", " "]) {
        const at = window.lastIndexOf(separator);
        if (at > size / 2) {
          end = start + at + separator.length;
          break;
        }
      }
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;

    // Retrocedemos el solape, pero empezando en una palabra entera.
    start = Math.max(end - overlap, start + 1);
    const space = clean.indexOf(" ", start);
    if (space !== -1 && space < end) start = space + 1;
  }

  return chunks;
}

export async function embedTexts(texts: string[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new EmbeddingError(
      "Falta OPENROUTER_API_KEY. Añádela a .env.local y reinicia el servidor."
    );
  }

  const model = process.env.OPENROUTER_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const embeddings: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += BATCH_SIZE) {
    const batch = texts.slice(offset, offset + BATCH_SIZE);
    embeddings.push(...(await embedBatch(apiKey, model, batch)));
  }

  return { embeddings, model };
}

async function embedBatch(apiKey: string, model: string, input: string[]) {
  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "reportAi",
      },
      body: JSON.stringify({ model, input }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (cause) {
    throw new EmbeddingError(`No se pudo contactar con OpenRouter: ${cause}`);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    const detail = payload?.error?.message ?? `HTTP ${response.status}`;
    throw new EmbeddingError(`OpenRouter respondió con error al generar embeddings: ${detail}`);
  }

  const data: { index: number; embedding: number[] }[] = payload?.data ?? [];
  if (data.length !== input.length) {
    throw new EmbeddingError(
      `Se esperaban ${input.length} embeddings y llegaron ${data.length}.`
    );
  }

  const ordered = [...data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  if (ordered.some((embedding) => embedding.length !== EMBEDDING_DIMENSIONS)) {
    throw new EmbeddingError(
      `El modelo ${model} no devuelve vectores de ${EMBEDDING_DIMENSIONS} dimensiones.`
    );
  }
  return ordered;
}

/** Formato de texto que acepta pgvector: '[0.1,0.2,…]'. */
export function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}
