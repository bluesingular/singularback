/**
 * server/src/context/tokens.ts
 *
 * Token estimation utilities.
 *
 * Uses the standard approximation of 1 token ≈ 4 characters (English).
 * For French text the ratio is slightly lower (~3.8 chars/token) but the
 * difference is within the safety margin of our token budgets.
 *
 * A full tiktoken integration can be added later without changing callers.
 */
const CHARS_PER_TOKEN = 4;
/**
 * Estimate the number of tokens in a string.
 */
export function estimateTokens(text) {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}
/**
 * Estimate tokens across multiple strings (summed).
 */
export function estimateTokensTotal(texts) {
    return texts.reduce((sum, t) => sum + estimateTokens(t), 0);
}
/**
 * Truncate text to fit within a token budget.
 * Cuts at a word boundary where possible.
 */
export function truncateToTokens(text, maxTokens) {
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    if (text.length <= maxChars)
        return text;
    // Cut at last space before the limit to avoid breaking mid-word
    const truncated = text.slice(0, maxChars);
    const lastSpace = truncated.lastIndexOf(" ");
    return lastSpace > maxChars * 0.8 ? truncated.slice(0, lastSpace) + "…" : truncated + "…";
}
//# sourceMappingURL=tokens.js.map