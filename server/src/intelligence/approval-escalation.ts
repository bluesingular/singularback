/**
 * server/src/intelligence/approval-escalation.ts
 *
 * F3 — Approval escalation path.
 *
 * Background worker checks every 15 minutes:
 *   High-priority tasks: escalate to Owner after 2 hours pending
 *   Normal tasks: include in morning intelligence next day
 *   Before 48h expiry: final escalation push notification
 *
 * Columns used: issues.approval_escalate_at, issues.escalation_level
 * (added in migration 0087_f1_f3_f7_t10_p4_p5_a3_ag1_ag2.sql)
 */

import { and, eq, lt, isNotNull, inArray } from "drizzle-orm";
import { issues, companies } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { createNotification } from "../notifications/service.js";
import pino from "pino";

const logger = pino({ name: "approval-escalation" });

const HIGH_PRIORITY_ESCALATION_MS  = 2  * 60 * 60 * 1000; // 2 hours
const FINAL_ESCALATION_HOURS_LEFT  = 4;                    // warn 4h before 48h expiry
const APPROVAL_EXPIRY_MS           = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Scan pending-approval tasks and send escalation notifications where warranted.
 * Safe to run repeatedly — escalation_level prevents duplicate notifications.
 */
export async function runApprovalEscalations(db: Db): Promise<{ escalated: number }> {
  const now = new Date();

  // Find tasks in pending_approval / awaiting_clarification that have an escalation_at set
  const pendingTasks = await (db as any)
    .select({
      id:               issues.id,
      companyId:        issues.companyId,
      title:            issues.title,
      priority:         issues.priority,
      status:           issues.status,
      escalationLevel:  (issues as any).escalationLevel,
      approvalEscalateAt: (issues as any).approvalEscalateAt,
      createdAt:        issues.createdAt,
    })
    .from(issues)
    .where(
      and(
        inArray(issues.status, ["in_review", "awaiting_clarification", "partial_complete"]),
        isNotNull((issues as any).approvalEscalateAt),
        lt((issues as any).approvalEscalateAt, now),
      ),
    );

  let escalated = 0;

  for (const task of pendingTasks) {
    const ageMs = now.getTime() - new Date(task.createdAt).getTime();
    const currentLevel: number = task.escalationLevel ?? 0;

    // Level 0 → Level 1: high-priority tasks after 2h, normal tasks after 24h
    if (currentLevel === 0) {
      const isHighPriority = task.priority === "high" || task.priority === "urgent";
      const thresholdMs = isHighPriority ? HIGH_PRIORITY_ESCALATION_MS : 24 * 60 * 60 * 1000;
      if (ageMs < thresholdMs) continue;

      try {
        await createNotification(db, {
          companyId: task.companyId,
          userId:    null,
          type:      "intelligence",
          title:     "Action requise",
          body:      `${task.title} — en attente depuis ${Math.round(ageMs / 3_600_000)}h.`,
          actionUrl: `/approbations`,
        });

        await (db as any)
          .update(issues)
          .set({ escalationLevel: 1, approvalEscalateAt: new Date(now.getTime() + HIGH_PRIORITY_ESCALATION_MS) })
          .where(eq(issues.id, task.id));

        escalated++;
        logger.info({ taskId: task.id, companyId: task.companyId, level: 1 }, "approval-escalation: level 1");
      } catch (err) {
        logger.error({ taskId: task.id, err }, "approval-escalation: notification failed");
      }
      continue;
    }

    // Level 1 → Level 2: final warning before 48h expiry
    if (currentLevel === 1) {
      const hoursLeft = (APPROVAL_EXPIRY_MS - ageMs) / 3_600_000;
      if (hoursLeft > FINAL_ESCALATION_HOURS_LEFT) continue;

      try {
        await createNotification(db, {
          companyId: task.companyId,
          userId:    null,
          type:      "intelligence",
          title:     "Dernière chance d'agir",
          body:      `${task.title} expire dans ${Math.round(hoursLeft)}h. Votre décision est requise.`,
          actionUrl: `/approbations`,
        });

        await (db as any)
          .update(issues)
          .set({ escalationLevel: 2 })
          .where(eq(issues.id, task.id));

        escalated++;
        logger.info({ taskId: task.id, companyId: task.companyId, level: 2 }, "approval-escalation: level 2 (final)");
      } catch (err) {
        logger.error({ taskId: task.id, err }, "approval-escalation: final notification failed");
      }
    }
  }

  return { escalated };
}
