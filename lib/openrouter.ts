const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash";

/** Fallo al hablar con OpenRouter; el mensaje se puede enseñar tal cual. */
export class OpenRouterError extends Error {}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type Message = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export function getApiKey() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError(
      "Falta OPENROUTER_API_KEY. Añádela a .env.local y reinicia el servidor."
    );
  }
  return apiKey;
}

export function getChatModel() {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

export async function chatCompletion(
  apiKey: string,
  model: string,
  messages: Message[],
  options: { responseFormat?: unknown; maxTokens?: number } = {}
): Promise<{ content: string; model: string }> {
  const body = {
    model,
    messages,
    ...(options.responseFormat !== undefined && { response_format: options.responseFormat }),
    temperature: 0,
    max_tokens: options.maxTokens ?? 8000,
  };

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // OpenRouter los usa para atribuir la app en su ranking; opcionales.
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "reportAi",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TimeoutError") {
      throw new OpenRouterError("El modelo tardó más de 3 minutos en responder.");
    }
    throw new OpenRouterError(`No se pudo contactar con OpenRouter: ${cause}`);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    const detail = payload?.error?.message ?? `HTTP ${response.status}`;
    throw new OpenRouterError(`OpenRouter respondió con error: ${detail}`);
  }

  const content: unknown = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new OpenRouterError("El modelo no devolvió contenido.");
  }

  return { content, model: payload?.model ?? model };
}
