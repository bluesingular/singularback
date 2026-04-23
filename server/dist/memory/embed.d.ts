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
export declare class EmbedError extends Error {
    constructor(message: string);
}
/**
 * Embed a text string using Mistral Embed via OpenRouter.
 * Returns a 1024-dimensional float32 vector.
 *
 * Throws EmbedError on API failure.
 */
export declare function embedText(text: string): Promise<number[]>;
//# sourceMappingURL=embed.d.ts.map