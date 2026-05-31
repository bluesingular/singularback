/**
 * server/src/memory/embed.ts
 *
 * Text embedding via Mistral Embed (1024 dimensions).
 * Called by storeMemory() to generate vectors and by searchMemory() to embed
 * the query before cosine similarity search.
 *
 * Model: mistralai/mistral-embed
 * Route: OpenRouter API (EU-hosted — GDPR compliant)
 *
 * RULE 2: OPENROUTER_API_KEY never reaches the LLM context.
 */

/**
 * T3 — Embedding model pin.
 * WARNING: changing EMBEDDING_CONFIG.model requires re-embedding ALL existing
 * memory_entries. Run: yarn scripts/re-embed-all --confirm before any change.
 */
export const EMBEDDING_CONFIG = {
  model:      "mistralai/mistral-embed",
  dimensions: 1024,
} as const;

const EMBED_MODEL  = EMBEDDING_CONFIG.model;
const EMBED_DIMS   = EMBEDDING_CONFIG.dimensions;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/embeddings";

export class EmbedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbedError";
  }
}

/**
 * Embed a text string using Mistral Embed via OpenRouter.
 * Returns a 1024-dimensional float32 vector.
 *
 * Throws EmbedError on API failure.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new EmbedError("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new EmbedError(
      `Mistral Embed failed: ${response.status} ${response.statusText} — ${body}`,
    );
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== EMBED_DIMS) {
    throw new EmbedError(
      `Unexpected embedding shape: expected ${EMBED_DIMS} dims, got ${embedding?.length ?? 0}`,
    );
  }

  return embedding;
}
