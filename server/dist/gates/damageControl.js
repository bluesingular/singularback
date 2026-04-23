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
import { damageControlEvents, auditEntries, memoryEntries } from "@paperclipai/db";
// ── Main function ─────────────────────────────────────────────────────────────
/**
 * Initiate damage control for an erroneous communication.
 * Called when operator clicks "Report an error" on a sent message.
 */
export async function initiateDamageControl(db, params) {
    // 1. Record the damage control event
    const [event] = await db
        .insert(damageControlEvents)
        .values({
        companyId: params.companyId,
        agentId: params.agentId,
        taskId: params.taskId,
        errorType: params.errorType,
        status: "in_progress",
        recoveryActions: params.recoveryActions,
        contactName: params.contactName ?? null,
        topic: params.topic ?? null,
    })
        .returning({
        id: damageControlEvents.id,
        companyId: damageControlEvents.companyId,
        agentId: damageControlEvents.agentId,
        taskId: damageControlEvents.taskId,
        errorType: damageControlEvents.errorType,
        status: damageControlEvents.status,
        recoveryActions: damageControlEvents.recoveryActions,
    });
    // 2. Write to audit trail (immutable record of the error report)
    await db.insert(auditEntries).values({
        companyId: params.companyId,
        agentId: params.agentId,
        taskId: params.taskId,
        actionType: "damage_control_initiated",
        actionData: {
            errorType: params.errorType,
            recoveryActions: params.recoveryActions,
            contactName: params.contactName,
            topic: params.topic,
        },
        result: "escalated",
    });
    // 3. Create memory entry warning about the error
    const contactLabel = params.contactName ?? "the contact";
    const topicLabel = params.topic ?? "the topic";
    const dateLabel = new Date().toISOString().slice(0, 10);
    await db.insert(memoryEntries).values({
        companyId: params.companyId,
        agentId: params.agentId,
        title: `Error reported: communication with ${contactLabel}`,
        content: `Error occurred communicating with ${contactLabel} on ${dateLabel} ` +
            `regarding "${topicLabel}" — handle with care. ` +
            `Error type: ${params.errorType}. Damage control initiated.`,
        importance: 5, // highest importance — always recalled
    });
    // 4. Trigger self-improvement if selected (M10 stub)
    if (params.recoveryActions.includes("trigger_improvement")) {
        await triggerSelfImprovementStub(params.companyId, params.agentId);
    }
    // 5. Trust Score reset (M9 stub)
    await resetTrustScoreStub(params.companyId, params.agentId);
    return {
        id: event.id,
        companyId: event.companyId,
        agentId: event.agentId,
        taskId: event.taskId,
        errorType: event.errorType,
        status: event.status ?? "in_progress",
        recoveryActions: event.recoveryActions ?? [],
    };
}
// ── Stubs for future modules ──────────────────────────────────────────────────
async function triggerSelfImprovementStub(companyId, agentId) {
    // M10: emit.improveSkill({ companyId, agentId, trigger: 'damage_control' })
    void companyId;
    void agentId;
}
async function resetTrustScoreStub(companyId, agentId) {
    // M9: trustService.resetForAgent(companyId, agentId)
    void companyId;
    void agentId;
}
//# sourceMappingURL=damageControl.js.map