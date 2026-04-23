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

import { eq, and, desc } from "drizzle-orm";
import { intelligenceCards, trustScores, issues } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import type { TaskApprovedJob } from "../queue/jobs.js";
import pino from "pino";

const logger = pino({ name: "console-service" });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConsoleCard {
  id:         string;
  cardType:   string;
  title:      string;
  body:       string;
  urgency:    number;
  actionUrl:  string | null;
  insightKey: string;
  createdAt:  Date;
}

export interface AgentTrustSummary {
  agentId:       string;
  skillType:     string;
  score:         string;
  autonomyLevel: string;
  approvalStreak: number;
}

export interface ConsoleContext {
  /** Unread intelligence cards, sorted urgency-descending */
  cards:      ConsoleCard[];
  /** Total pending + active jobs in the agent queue */
  queueDepth: number;
  /** Current trust state for all agents in this company */
  trustState: AgentTrustSummary[];
}

/** Minimal BullMQ Queue interface needed by the console */
export interface QueueHandle {
  getJobCounts: (...statuses: string[]) => Promise<Record<string, number>>;
}

// ── getConsoleContext ─────────────────────────────────────────────────────────

/**
 * Build the full context object shown when the operator opens the CEO Console.
 *
 * Fetches:
 *  1. Unread intelligence cards for this company (urgency DESC)
 *  2. Agent queue depth (pending + active jobs)
 *  3. Trust scores for all agents in this company
 */
export async function getConsoleContext(
  db:         Db,
  agentQueue: QueueHandle,
  companyId:  string,
): Promise<ConsoleContext> {
  // 1. Unread cards — ordered by urgency descending so highest-priority shows first
  const cards = await (db as any)
    .select({
      id:         intelligenceCards.id,
      cardType:   intelligenceCards.cardType,
      title:      intelligenceCards.title,
      body:       intelligenceCards.body,
      urgency:    intelligenceCards.urgency,
      actionUrl:  intelligenceCards.actionUrl,
      insightKey: intelligenceCards.insightKey,
      createdAt:  intelligenceCards.createdAt,
    })
    .from(intelligenceCards)
    .where(
      and(
        eq(intelligenceCards.companyId, companyId),
        eq(intelligenceCards.status, "unread"),
      ),
    )
    .orderBy(desc(intelligenceCards.urgency));

  // 2. Queue depth — pending + active jobs represent work in flight
  const counts = await agentQueue.getJobCounts("waiting", "active", "delayed");
  const queueDepth = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);

  // 3. Trust state — all agents for this company
  const trustState = await (db as any)
    .select({
      agentId:        trustScores.agentId,
      skillType:      trustScores.skillType,
      score:          trustScores.score,
      autonomyLevel:  trustScores.autonomyLevel,
      approvalStreak: trustScores.approvalStreak,
    })
    .from(trustScores)
    .where(eq(trustScores.companyId, companyId));

  logger.info(
    { companyId, cardCount: cards.length, queueDepth, agentCount: trustState.length },
    "console-service: context loaded",
  );

  return { cards, queueDepth, trustState };
}

// ── approveConsoleCard ────────────────────────────────────────────────────────

export class ConsoleApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsoleApprovalError";
  }
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
export async function approveConsoleCard(
  db:                Db,
  emitTaskApproved:  (data: TaskApprovedJob) => Promise<unknown>,
  params: {
    cardId:    string;
    taskId:    string;
    companyId: string;
    userId:    string;
  },
): Promise<void> {
  const { cardId, taskId, companyId, userId } = params;

  // Mark card as read
  const updated = await (db as any)
    .update(intelligenceCards)
    .set({ status: "read" })
    .where(
      and(
        eq(intelligenceCards.id, cardId),
        eq(intelligenceCards.companyId, companyId),
      ),
    )
    .returning({ id: intelligenceCards.id });

  if (!updated || updated.length === 0) {
    throw new ConsoleApprovalError(
      `Card ${cardId} not found for company ${companyId}`,
    );
  }

  // Load task (issue) to get agentId
  const [task] = await db
    .select({ agentId: issues.assigneeAgentId })
    .from(issues)
    .where(eq(issues.id, taskId))
    .limit(1);

  if (!task || !task.agentId) {
    throw new ConsoleApprovalError(`Task ${taskId} not found or has no assigned agent`);
  }

  // Fire task execution (RULE 7 — approval triggers immediate execution)
  await emitTaskApproved({
    taskId,
    companyId,
    agentId: task.agentId,
    approvedBy: userId,
  });

  logger.info({ companyId, cardId, taskId }, "console-service: card approved → execution triggered");
}
