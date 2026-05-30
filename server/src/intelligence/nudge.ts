/**
 * server/src/intelligence/nudge.ts
 *
 * Auto-nudge — §11.5.
 *
 * When a task completes, shouldNudge() decides whether to send a push
 * notification immediately (vs waiting for morning intelligence at 8am).
 *
 * Nudge conditions (from spec):
 *   - task priority is 'high' or 'critical'
 *   - task type is 'external_communication_completed'
 *   - task has a blocked_reason (something needs operator attention)
 *
 * The nudge fires a push notification to all company members and injects a
 * synthetic message into the active mission thread via the notification service.
 */

import pino from "pino";
import type { Db } from "@paperclipai/db";
import { createNotification } from "../notifications/service.js";

const logger = pino({ name: "nudge" });

export interface NudgeTask {
  id:           string;
  companyId:    string;
  title:        string;
  priority?:    string | null;
  taskType?:    string | null;
  blockedReason?: string | null;
  agentName?:   string | null;
}

export function shouldNudge(task: NudgeTask): boolean {
  return (
    task.priority === "high" ||
    task.priority === "critical" ||
    task.taskType === "external_communication_completed" ||
    !!task.blockedReason
  );
}

/**
 * Fire an immediate push notification when a high-signal task completes.
 * No-ops if shouldNudge() returns false.
 */
export async function nudgeOnTaskComplete(db: Db, task: NudgeTask): Promise<void> {
  if (!shouldNudge(task)) return;

  const agentLabel = task.agentName ? `${task.agentName} — ` : "";
  const title = task.blockedReason
    ? `Attention requise`
    : `Tâche terminée`;
  const body = task.blockedReason
    ? `${agentLabel}${task.title} — action requise.`
    : `${agentLabel}${task.title}`;

  try {
    await createNotification(db, {
      companyId: task.companyId,
      userId:    null, // all company members
      type:      "intelligence",
      title,
      body,
      actionUrl: `/tasks/${task.id}`,
    });
  } catch (err) {
    logger.error({ taskId: task.id, err }, "nudge: notification failed");
  }

  logger.info({ taskId: task.id, title }, "nudge: fired");
}
