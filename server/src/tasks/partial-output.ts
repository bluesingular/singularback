/**
 * server/src/tasks/partial-output.ts
 *
 * Gap H — Graceful partial output delivery.
 *
 * Skills with partial_delivery: true in SKILL.md submit what they completed
 * if a step fails — never silently discards completed work.
 *
 * Task transitions to 'partial_complete' status.
 * Operator options: approve partial | request completion | reject all.
 * Appears in 'Votre attention' column — requires a decision.
 */

import { and, eq } from "drizzle-orm";
import { issues, taskExecutionEvents } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "partial-output" });

export interface PartialResult {
  completedItems:  unknown[];
  failedItems:     { index: number; reason: string }[];
  completionPct:   number;
  failureSummary:  string;   // plain French: what failed and why
  retryAvailable:  boolean;
}

/**
 * Transition a task to 'partial_complete' with its partial results.
 * The partial results are stored in the task's metadata so the operator
 * can review what was completed and what failed.
 */
export async function submitPartialOutput(
  db:        Db,
  taskId:    string,
  companyId: string,
  result:    PartialResult,
): Promise<void> {
  const [existing] = await db
    .select({ status: issues.status })
    .from(issues)
    .where(and(eq(issues.id, taskId), eq(issues.companyId, companyId)))
    .limit(1);

  if (!existing) {
    logger.warn({ taskId }, "partial-output: task not found");
    return;
  }

  if (existing.status !== "in_progress") {
    logger.warn({ taskId, status: existing.status }, "partial-output: task not in_progress");
    return;
  }

  // Record partial result as a task execution event (F7 table)
  await db.insert(taskExecutionEvents).values({
    taskId,
    companyId,
    eventType: "partial_result",
    content:   JSON.stringify(result),
  });

  await (db as any)
    .update(issues)
    .set({
      status:    "partial_complete",
      updatedAt: new Date(),
    })
    .where(and(eq(issues.id, taskId), eq(issues.companyId, companyId)));

  logger.info(
    {
      taskId,
      completionPct: result.completionPct,
      completedCount: result.completedItems.length,
      failedCount:    result.failedItems.length,
    },
    "partial-output: task moved to partial_complete",
  );
}

/**
 * Approve partial output — operator accepts what was completed.
 * Transitions task to 'done'.
 */
export async function approvePartialOutput(
  db:        Db,
  taskId:    string,
  companyId: string,
): Promise<void> {
  await (db as any)
    .update(issues)
    .set({ status: "done", updatedAt: new Date() })
    .where(
      and(
        eq(issues.id, taskId),
        eq(issues.companyId, companyId),
        eq(issues.status, "partial_complete"),
      ),
    );

  logger.info({ taskId }, "partial-output: partial approved");
}

/**
 * Request completion of failed items — transitions back to 'in_progress'.
 * The worker picks up from the last successful checkpoint (AG-3).
 */
export async function requestPartialCompletion(
  db:        Db,
  taskId:    string,
  companyId: string,
): Promise<void> {
  await (db as any)
    .update(issues)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(
      and(
        eq(issues.id, taskId),
        eq(issues.companyId, companyId),
        eq(issues.status, "partial_complete"),
      ),
    );

  logger.info({ taskId }, "partial-output: completion requested");
}
