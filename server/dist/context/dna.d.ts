/**
 * server/src/context/dna.ts
 *
 * Company DNA service — reads and formats the company's identity data
 * for injection into agent context (Layer 2 of assembleContext).
 *
 * Two variants:
 *   - getDnaCompressed: ~300 tokens, for T0/T1 models with tight budgets
 *   - getDnaFull:       ~2000 tokens, for T2+ models with richer context
 */
import type { Db } from "@paperclipai/db";
export interface DnaRecord {
    description: string;
    customerProfile: string;
    tone: string;
    brandRules: string;
    regulatoryContext: string;
    forbiddenTopics: string[];
    terminology: Record<string, string>;
    competitors: string[];
}
/**
 * Fetch raw DNA record for a company. Returns null if no DNA has been
 * configured yet (new company, onboarding not complete).
 */
export declare function getDna(db: Db, companyId: string): Promise<DnaRecord | null>;
/**
 * Short DNA summary for T0/T1 context — approximately 300 tokens.
 * Covers the essentials: identity, audience, tone, hard limits.
 */
export declare function getDnaCompressed(db: Db, companyId: string): Promise<string>;
/**
 * Full DNA for T2/T3 context — approximately 2000 tokens.
 * Includes all fields as structured markdown for richer agent grounding.
 */
export declare function getDnaFull(db: Db, companyId: string): Promise<string>;
/**
 * Upsert DNA for a company. Called from the Settings / Company DNA UI.
 */
export declare function upsertDna(db: Db, companyId: string, data: Partial<Omit<DnaRecord, "forbiddenTopics" | "terminology" | "competitors">> & {
    forbiddenTopics?: string[];
    terminology?: Record<string, string>;
    competitors?: string[];
}, updatedBy?: string): Promise<void>;
//# sourceMappingURL=dna.d.ts.map