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
/**
 * Estimate the number of tokens in a string.
 */
export declare function estimateTokens(text: string): number;
/**
 * Estimate tokens across multiple strings (summed).
 */
export declare function estimateTokensTotal(texts: string[]): number;
/**
 * Truncate text to fit within a token budget.
 * Cuts at a word boundary where possible.
 */
export declare function truncateToTokens(text: string, maxTokens: number): string;
//# sourceMappingURL=tokens.d.ts.map