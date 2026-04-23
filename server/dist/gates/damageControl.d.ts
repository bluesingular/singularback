/**
 * server/src/gates/damageControl.ts
 *
 * Damage control flow — activated when an operator marks a sent
 * communication as erroneous.
 *
 * Flow (spec section 14.5):
 *   1. Record the damage control event
 *   2. Suspend agent's send permission for 24h (temporary flag)
 *   3. Create a memory entry warning about the error (for future context)
 *   4. Trigger self-improvement analysis if requested (M10 stub)
 *
 * The correction draft goes through normal approval flow (not auto-sent).
 * Trust Score for the relevant skill resets (M9 stub).
 */
import type { Db } from "@paperclipai/db";
export type ErrorType = "wrong_tone" | "wrong_recipient" | "incorrect_info" | "should_not_send";
export type RecoveryAction = "draft_correction" | "mark_sensitive" | "trigger_improvement" | "suspend_skill";
export interface DamageControlParams {
    companyId: string;
    agentId: string;
    taskId: string;
    errorType: ErrorType;
    recoveryActions: RecoveryAction[];
    contactName?: string;
    topic?: string;
}
export interface DamageControlEvent {
    id: string;
    companyId: string;
    agentId: string;
    taskId: string;
    errorType: ErrorType;
    status: string;
    recoveryActions: RecoveryAction[];
}
/**
 * Initiate damage control for an erroneous communication.
 * Called when operator clicks "Report an error" on a sent message.
 */
export declare function initiateDamageControl(db: Db, params: DamageControlParams): Promise<DamageControlEvent>;
//# sourceMappingURL=damageControl.d.ts.map