/**
 * server/src/safety/collision.ts
 *
 * C2 — Agent collision detection.
 *
 * Checks whether a contact has already been reached out to within the
 * cooldown window before any external_communication action proceeds.
 *
 * Called by the action executor before sending any external communication.
 * If a collision is detected, the task is blocked (status → blocked,
 * failure_reason → null, a notification is surfaced to the operator).
 */

import { and, eq, gt, desc } from "drizzle-orm";
import { contactEvents } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "collision-detection" });

export const DEFAULT_COOLDOWN_HOURS = 24;

export interface CollisionResult {
  collision:    boolean;
  lastContact?: Date;
  taskId?:      string;
}

/**
 * Returns { collision: true } if the contact was already reached within
 * cooldownHours. Returns { collision: false } if safe to proceed.
 */
export async function checkContactCollision(
  db:            Db,
  companyId:     string,
  contactId:     string,
  cooldownHours: number = DEFAULT_COOLDOWN_HOURS,
): Promise<CollisionResult> {
  const since = new Date(Date.now() - cooldownHours * 3_600_000);

  const [recent] = await db
    .select({
      createdAt: contactEvents.occurredAt,
      taskId:    contactEvents.taskId,
    })
    .from(contactEvents)
    .where(
      and(
        eq(contactEvents.companyId, companyId),
        eq(contactEvents.contactId, contactId),
        eq(contactEvents.eventType, "external_communication"),
        gt(contactEvents.occurredAt, since),
      ),
    )
    .orderBy(desc(contactEvents.occurredAt))
    .limit(1);

  if (recent) {
    logger.info(
      { companyId, contactId, lastContact: recent.createdAt },
      "collision-detection: contact reached recently",
    );
    return {
      collision:   true,
      lastContact: recent.createdAt,
      taskId:      recent.taskId ?? undefined,
    };
  }

  return { collision: false };
}

/**
 * Record that an external communication was sent to a contact.
 * Call this AFTER successfully sending, so the next attempt is blocked.
 */
export async function recordExternalCommunication(
  db:        Db,
  companyId: string,
  contactId: string,
  agentId:   string,
  taskId:    string,
  summary:   string,
): Promise<void> {
  await db.insert(contactEvents).values({
    companyId,
    contactId,
    agentId,
    taskId,
    eventType:  "external_communication",
    summary,
    occurredAt: new Date(),
  });

  logger.info({ companyId, contactId, taskId }, "collision-detection: communication recorded");
}
