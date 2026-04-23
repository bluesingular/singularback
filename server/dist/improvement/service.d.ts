/**
 * server/src/improvement/service.ts
 *
 * Skill self-improvement orchestration — M10.
 *
 * triggerImprovement()   — entry point: checks conditions, creates draft version.
 * activateSkillVersion() — post-benchmark step: applies Tier A/B activation rule.
 *
 * RULE (mirrors M9 Tier A / Tier B logic for skill versions):
 *   Tier A skill → new version goes to "pending_approval"; human must approve.
 *   Tier B skill → new version auto-activates (current → deprecated, new → active).
 *
 * CONSTRAINT: activateSkillVersion() MUST be called AFTER runBenchmark() has set
 *   a benchmarkScore on the draft row. Calling it on an un-benchmarked draft throws.
 */
import type { Db } from "@paperclipai/db";
import { type TriggerReason } from "./analyser.js";
export interface TriggerImprovementParams {
    companyId: string;
    agentId: string;
    skillType: string;
    trustScore: number;
    triggerReason: TriggerReason | null;
    newPromptBody: string;
    newFrontmatter: Record<string, unknown>;
}
export interface TriggerImprovementResult {
    triggered: boolean;
    draftVersionId: string | null;
    reason: string;
}
/**
 * Check conditions and create a draft skill version if improvement is warranted.
 * The benchmark runs separately (via BullMQ in M12) after this returns.
 */
export declare function triggerImprovement(db: Db, params: TriggerImprovementParams): Promise<TriggerImprovementResult>;
export interface ActivateSkillVersionParams {
    companyId: string;
    draftVersionId: string;
    skillType: string;
    /** From skill frontmatter — Tier A requires human approval */
    skillAutonomyTier: "A" | "B";
    /** BenchmarkDecision from runBenchmark() — must not be null */
    benchmarkDecision: "proceed" | "neutral" | "block";
}
export interface ActivateSkillVersionResult {
    activated: boolean;
    pendingApproval: boolean;
    blocked: boolean;
    newStatus: string;
}
/**
 * Apply the Tier A/B activation rule after a successful benchmark.
 *
 * MUST be called after runBenchmark() — throws if version has no benchmarkScore.
 *
 * Tier A + proceed/neutral → status = "pending_approval" (human approves in M13)
 * Tier B + proceed/neutral → status = "active" (current active → deprecated)
 * block (any tier)         → status = "blocked" (stays in history, not activated)
 */
export declare function activateSkillVersion(db: Db, params: ActivateSkillVersionParams): Promise<ActivateSkillVersionResult>;
//# sourceMappingURL=service.d.ts.map