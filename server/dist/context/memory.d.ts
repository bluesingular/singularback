/**
 * server/src/context/memory.ts
 *
 * Org memory retrieval for Layer 4 of assembleContext().
 *
 * M8 upgrade: delegates to searchMemory() in memory/service.ts which uses
 * pgvector cosine similarity (threshold 0.72, Mistral Embed 1024-dim).
 *
 * The interface is stable — assembler.ts is unaffected by the M8 upgrade.
 *
 * RULE 5: task content is never truncated — memory is compressed first.
 */
import type { Db } from "@paperclipai/db";
export interface MemoryRetrievalParams {
    companyId: string;
    query: string;
    maxChunks: number;
    maxTokens: number;
}
export interface MemoryRetrievalResult {
    text: string;
    chunksUsed: number;
}
/**
 * Retrieve relevant org memory entries for context injection.
 * Uses pgvector cosine similarity > 0.72 (M8).
 */
export declare function retrieveMemory(db: Db, params: MemoryRetrievalParams): Promise<MemoryRetrievalResult>;
//# sourceMappingURL=memory.d.ts.map