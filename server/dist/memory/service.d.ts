/**
 * server/src/memory/service.ts
 *
 * Org memory service — M8 implementation.
 *
 * Exports:
 *   storeMemory()          — embed + write to memory_entries
 *   searchMemory()         — pgvector cosine similarity > 0.72
 *   buildContactProfile()  — formats contact + events + notes into context text
 *   injectContactProfile() — extracts name from query, returns profile or null
 *
 * The 0.72 cosine similarity threshold is the project standard (CLAUDE.md M8).
 * Entries below this threshold are not surfaced even if they exist.
 *
 * RULE 5: task content is never truncated — memory is compressed first.
 */
import type { Db } from "@paperclipai/db";
export declare const SIMILARITY_THRESHOLD = 0.72;
export interface StoreMemoryParams {
    companyId: string;
    agentId?: string;
    title: string;
    content: string;
    importance: 1 | 2 | 3 | 4 | 5;
}
export interface MemorySearchResult {
    id: string;
    title: string;
    content: string;
    importance: number;
    similarity: number;
}
export interface SearchMemoryParams {
    companyId: string;
    query: string;
    maxChunks: number;
    maxTokens: number;
}
export interface SearchMemoryOutput {
    text: string;
    chunksUsed: number;
}
/**
 * Generate an embedding for the memory entry and persist it.
 * Called by agents after completing a task with noteworthy outcomes.
 */
export declare function storeMemory(db: Db, params: StoreMemoryParams): Promise<void>;
/**
 * Semantic search over org memory using pgvector cosine similarity.
 * Only entries with similarity > SIMILARITY_THRESHOLD (0.72) are returned.
 *
 * Falls back to empty result (no crash) if embedding column is null on a row.
 */
export declare function searchMemory(db: Db, params: SearchMemoryParams): Promise<SearchMemoryOutput>;
/**
 * Build a formatted contact profile for injection into Layer 4 context.
 * Returns empty string if the contact is not found.
 */
export declare function buildContactProfile(db: Db, companyId: string, contactName: string): Promise<string>;
/**
 * Contact injection trigger — M8.
 *
 * Scans the query text for potential contact names (capitalised 2+ word groups)
 * and returns the first matching contact profile from the DB.
 *
 * Returns null when no contact is found (no injection).
 */
export declare function injectContactProfile(db: Db, companyId: string, query: string): Promise<string | null>;
//# sourceMappingURL=service.d.ts.map