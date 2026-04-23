/**
 * server/src/context/assembler.ts
 *
 * 6-layer context assembly pipeline.
 * Called before every LLM invocation to build the agent's full context.
 *
 * Layer order (compression priority if over-budget — Rule 5):
 *   1. System identity    — NEVER truncated
 *   2. Company DNA        — compressed first for T0/T1, never removed entirely
 *   3. Current task       — NEVER truncated (CLAUDE.md RULE 5 invariant)
 *   4. Org memory         — reduced to min chunks first
 *   5. Recent outputs     — truncated next
 *   6. Skill instructions — reduced last
 */
import type { Db } from "@paperclipai/db";
export declare const TOKEN_BUDGETS: {
    readonly T0: {
        readonly identity: 200;
        readonly dna: 300;
        readonly task: 500;
        readonly memory: 500;
        readonly outputs: 200;
        readonly skill: 500;
    };
    readonly T1: {
        readonly identity: 300;
        readonly dna: 600;
        readonly task: 2000;
        readonly memory: 2000;
        readonly outputs: 600;
        readonly skill: 1500;
    };
    readonly T2: {
        readonly identity: 300;
        readonly dna: 1200;
        readonly task: 5000;
        readonly memory: 8000;
        readonly outputs: 2000;
        readonly skill: 3000;
    };
    readonly T3: {
        readonly identity: 300;
        readonly dna: 2000;
        readonly task: 10000;
        readonly memory: 20000;
        readonly outputs: 5000;
        readonly skill: 5000;
    };
};
export type Tier = keyof typeof TOKEN_BUDGETS;
export interface AgentForContext {
    id: string;
    name: string;
    companyId: string;
    description?: string | null;
}
export interface TaskForContext {
    id: string;
    title: string;
    description?: string | null;
    /** Full task body / instructions if available */
    body?: string | null;
    priority?: string | null;
}
export interface CompanyForContext {
    id: string;
    name: string;
    /** Sector from onboarding (e.g. "recruitment", "legal") */
    sector?: string | null;
}
export interface SkillForContext {
    name: string;
    description: string;
    /** Markdown body below the YAML frontmatter */
    body: string;
}
export interface RecentOutput {
    taskTitle: string;
    outputSummary: string;
    completedAt: Date;
}
export interface AssembledContext {
    /** Layer 1 — who the agent is */
    systemIdentity: string;
    /** Layer 2 — what the company does */
    companyDna: string;
    /** Layer 3 — what needs to be done now */
    currentTask: string;
    /** Layer 4 — relevant org knowledge */
    orgMemory: string;
    /** Layer 5 — agent's recent work */
    recentOutputs: string;
    /** Layer 6 — skill-specific instructions */
    skillInstructions: string;
    totalTokens: number;
    memoryChunksUsed: number;
    compressionApplied: boolean;
}
export declare function assembleContext(db: Db, params: {
    agent: AgentForContext;
    task: TaskForContext;
    company: CompanyForContext;
    skill: SkillForContext;
    tier: Tier;
    recentOutputs?: RecentOutput[];
}): Promise<AssembledContext>;
/**
 * Flatten the assembled context into an array of messages for the LLM.
 * System message = identity + DNA + skill. User message = task + memory + outputs.
 */
export declare function contextToMessages(ctx: AssembledContext): Array<{
    role: "system" | "user";
    content: string;
}>;
//# sourceMappingURL=assembler.d.ts.map