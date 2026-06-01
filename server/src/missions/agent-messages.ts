/**
 * server/src/missions/agent-messages.ts
 *
 * AG-2 — Agent-to-agent peer communication.
 *
 * Lightweight peer channel within a mission. Messages are informational only —
 * no agent message can trigger an external action. Approval gate invariant is
 * fully preserved.
 *
 * Messages are injected into the recipient's context on their next execution
 * within the same mission (pull model, not push).
 */

import { and, eq, isNull, isNotNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentMessages } from "@paperclipai/db";

export type MessageType = "question" | "finding" | "confirmation" | "alert";

// ── Send ──────────────────────────────────────────────────────────────────────

export interface SendAgentMessageOpts {
  missionId:   string;
  companyId:   string;
  fromAgentId: string;
  toAgentId:   string | null;   // null = broadcast to all agents on mission
  content:     string;
  messageType: MessageType;
}

export async function sendAgentMessage(
  db: Db,
  opts: SendAgentMessageOpts,
): Promise<string> {
  const [row] = await db
    .insert(agentMessages)
    .values({
      missionId:   opts.missionId,
      companyId:   opts.companyId,
      fromAgentId: opts.fromAgentId,
      toAgentId:   opts.toAgentId ?? null,
      content:     opts.content,
      messageType: opts.messageType,
    })
    .returning({ id: agentMessages.id });
  return row.id;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Fetch all messages for a mission (ordered chronologically). */
export async function getMissionMessages(
  db: Db,
  missionId: string,
  companyId: string,
) {
  return db.query.agentMessages.findMany({
    where: and(
      eq(agentMessages.missionId, missionId),
      eq(agentMessages.companyId, companyId),
    ),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });
}

/**
 * Fetch messages that should be injected into an agent's context at execution time.
 * Returns:
 *   - Direct messages addressed to this agent (not yet replied to)
 *   - Broadcast messages on this mission (toAgentId IS NULL, not yet replied to)
 */
export async function getPendingMessagesForAgent(
  db: Db,
  missionId: string,
  agentId: string,
  companyId: string,
) {
  const [direct, broadcast] = await Promise.all([
    db.query.agentMessages.findMany({
      where: and(
        eq(agentMessages.missionId, missionId),
        eq(agentMessages.companyId, companyId),
        eq(agentMessages.toAgentId, agentId),
        isNull(agentMessages.repliedAt),
      ),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    }),
    db.query.agentMessages.findMany({
      where: and(
        eq(agentMessages.missionId, missionId),
        eq(agentMessages.companyId, companyId),
        isNull(agentMessages.toAgentId),
        isNull(agentMessages.repliedAt),
      ),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    }),
  ]);

  // Deduplicate (broadcast messages the agent itself sent are excluded)
  const seen = new Set<string>();
  const combined = [...direct, ...broadcast].filter((m) => {
    if (seen.has(m.id)) return false;
    if (m.fromAgentId === agentId) return false;   // never inject own messages
    seen.add(m.id);
    return true;
  });

  combined.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return combined;
}

// ── Reply ─────────────────────────────────────────────────────────────────────

/** Record an agent's reply to a message. Marks it as replied so it won't be re-injected. */
export async function replyToAgentMessage(
  db: Db,
  opts: {
    messageId:    string;
    companyId:    string;
    replyContent: string;
  },
): Promise<void> {
  await db
    .update(agentMessages)
    .set({
      repliedAt:    new Date(),
      replyContent: opts.replyContent,
    })
    .where(
      and(
        eq(agentMessages.id, opts.messageId),
        eq(agentMessages.companyId, opts.companyId),
        isNull(agentMessages.repliedAt),
      ),
    );
}
