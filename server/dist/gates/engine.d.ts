/**
 * server/src/gates/engine.ts
 *
 * Quality gate engine — runs all active gates for a given action before
 * the action is executed. Auto-protection gates are always active.
 *
 * RULE 3: Every external action passes runGates(). No bypass path.
 *
 * Gate types:
 *   volume_limit       — max N emails/day per agent (blocks)
 *   recipient_whitelist — only allowed domains (blocks)
 *   budget_limit       — monthly spend limit (escalates for approval)
 *   content_forbidden  — forbidden words/topics in content (escalates)
 *   custom             — always passes (future extensibility)
 *
 * On failure:
 *   block    → violation + audit entry written, action stopped
 *   escalate → violation + audit entry + approval_request created, action stopped
 */
import type { Db } from "@paperclipai/db";
export type GateResult = {
    passed: true;
} | {
    passed: false;
    reason: string;
    action: "block" | "escalate";
};
export interface RunGatesParams {
    companyId: string;
    agentId: string;
    taskId: string;
    actionType: "send_email" | "publish_content" | "contact_external" | "api_call";
    actionData: Record<string, unknown>;
}
/**
 * Run all active gates for a company+agent action.
 * First failing gate stops evaluation (fail-fast).
 * Always writes an audit entry (success or failure).
 *
 * RULE 3: No bypass. Call this before every external action.
 */
export declare function runGates(db: Db, params: RunGatesParams): Promise<GateResult>;
//# sourceMappingURL=engine.d.ts.map