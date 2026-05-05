/**
 * server/src/handoff/service.ts
 *
 * Agent-to-agent handoff evaluator.
 *
 * When an operator approves a task with a star rating, this service checks
 * whether the completing agent has any handoff rules whose condition is
 * satisfied, and creates follow-on tasks for the target agents.
 *
 * Currently supported conditions:
 *   cv_score_gte_4  — fires when rating >= 4 (used by qualification-cv → client-email)
 *
 * Handoff rules are stored in agents.metadata.handoffs (set by the pack installer).
 */
import type { Db } from "@paperclipai/db";
export interface HandoffContext {
    companyId: string;
    /** ID of the issue that was just approved */
    issueId: string;
    /** ID of the agent that completed the task */
    agentId: string;
    /** Star rating submitted by the operator (1–5) */
    rating: number;
    /** Any variables to interpolate into the task template */
    variables?: Record<string, string>;
}
export interface HandoffResult {
    triggered: boolean;
    handoffCount: number;
    issueIds: string[];
}
export declare function evaluateHandoffs(db: Db, ctx: HandoffContext): Promise<HandoffResult>;
//# sourceMappingURL=service.d.ts.map