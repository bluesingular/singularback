/**
 * server/src/console/service.ts
 *
 * CEO Console — M13.
 *
 * The console is the operator's command centre. It opens pre-loaded with:
 *   - Unread intelligence cards (urgency-sorted, max shown per spec)
 *   - Queue depth: pending + active jobs in the agent queue
 *   - Trust state: current autonomy level + score per agent×skill
 *
 * Approval flow:
 *   approveConsoleCard() → calls emit.taskApproved() → triggers immediate execution
 *   The card is marked "read" atomically so it does not reappear on refresh.
 *
 * RULE 7: approval flow is non-negotiable — no auto-execution before human confirms.
 */
import type { Db } from "@paperclipai/db";
import type { TaskApprovedJob } from "../queue/jobs.js";
export interface ConsoleCard {
    id: string;
    cardType: string;
    title: string;
    body: string;
    urgency: number;
    actionUrl: string | null;
    insightKey: string;
    createdAt: Date;
}
export interface AgentTrustSummary {
    agentId: string;
    skillType: string;
    score: string;
    autonomyLevel: string;
    approvalStreak: number;
}
export interface ConsoleContext {
    /** Unread intelligence cards, sorted urgency-descending */
    cards: ConsoleCard[];
    /** Total pending + active jobs in the agent queue */
    queueDepth: number;
    /** Current trust state for all agents in this company */
    trustState: AgentTrustSummary[];
}
/** Minimal BullMQ Queue interface needed by the console */
export interface QueueHandle {
    getJobCounts: (...statuses: string[]) => Promise<Record<string, number>>;
}
/**
 * Build the full context object shown when the operator opens the CEO Console.
 *
 * Fetches:
 *  1. Unread intelligence cards for this company (urgency DESC)
 *  2. Agent queue depth (pending + active jobs)
 *  3. Trust scores for all agents in this company
 */
export declare function getConsoleContext(db: Db, agentQueue: QueueHandle, companyId: string): Promise<ConsoleContext>;
export declare class ConsoleApprovalError extends Error {
    constructor(message: string);
}
/**
 * Approve a card in the console.
 *
 * - Marks the intelligence card as "read" so it disappears from the console.
 * - Fires emit.taskApproved() to trigger immediate agent execution (RULE 7).
 *
 * @param emitTaskApproved  Injected so callers can pass the real emit.taskApproved
 *                          or a test stub. Avoids importing BullMQ directly.
 */
export declare function approveConsoleCard(db: Db, emitTaskApproved: (data: TaskApprovedJob) => Promise<unknown>, params: {
    cardId: string;
    taskId: string;
    companyId: string;
    userId: string;
}): Promise<void>;
//# sourceMappingURL=service.d.ts.map