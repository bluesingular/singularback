/**
 * server/src/tasks/checkpoints.ts
 *
 * AG-3 — Long-horizon task checkpointing.
 *
 * Write a checkpoint after EVERY successful step boundary in task execution.
 * On worker restart: resume from latest checkpoint, not from beginning.
 *
 * Checkpoints are transient — deleted on task completion, not in audit trail.
 */

import { and, desc, eq } from "drizzle-orm";
import { taskCheckpoints, issues } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "checkpoints" });

export interface CheckpointContext {
  stepNumber:    number;
  stepName:      string;
  executionState: Record<string, unknown>;
  contextSnapshot?: Record<string, unknown>;
  outputsSoFar?:  Record<string, unknown>;
}

/**
 * Write a checkpoint for the current step.
 * Called at every successful step boundary — safe to call frequently.
 */
export async function writeCheckpoint(
  db:        Db,
  taskId:    string,
  companyId: string,
  ctx:       CheckpointContext,
): Promise<void> {
  await db.insert(taskCheckpoints).values({
    taskId,
    companyId,
    stepNumber:      ctx.stepNumber,
    stepName:        ctx.stepName,
    executionState:  ctx.executionState,
    contextSnapshot: ctx.contextSnapshot ?? null,
    outputsSoFar:    ctx.outputsSoFar ?? null,
  });

  logger.info(
    { taskId, stepNumber: ctx.stepNumber, stepName: ctx.stepName },
    "checkpoint: written",
  );
}

/**
 * Load the latest checkpoint for a task.
 * Returns null if no checkpoint exists (fresh start).
 */
export async function loadLatestCheckpoint(
  db:        Db,
  taskId:    string,
  companyId: string,
): Promise<CheckpointContext | null> {
  const [row] = await db
    .select()
    .from(taskCheckpoints)
    .where(
      and(
        eq(taskCheckpoints.taskId, taskId),
        eq(taskCheckpoints.companyId, companyId),
      ),
    )
    .orderBy(desc(taskCheckpoints.stepNumber))
    .limit(1);

  if (!row) return null;

  return {
    stepNumber:      row.stepNumber,
    stepName:        row.stepName,
    executionState:  row.executionState as Record<string, unknown>,
    contextSnapshot: row.contextSnapshot as Record<string, unknown> | undefined,
    outputsSoFar:    row.outputsSoFar   as Record<string, unknown> | undefined,
  };
}

/**
 * Delete all checkpoints for a completed task.
 * Must be called when task reaches terminal state (done/cancelled/failed).
 */
export async function clearCheckpoints(
  db:        Db,
  taskId:    string,
  companyId: string,
): Promise<void> {
  await db
    .delete(taskCheckpoints)
    .where(
      and(
        eq(taskCheckpoints.taskId, taskId),
        eq(taskCheckpoints.companyId, companyId),
      ),
    );

  logger.info({ taskId }, "checkpoint: cleared on task completion");
}

// ── C3: Cancellation check ────────────────────────────────────────────────────

export class TaskCancelledException extends Error {
  constructor(public readonly taskId: string) {
    super(`Task ${taskId} was cancelled by operator`);
    this.name = "TaskCancelledException";
  }
}

/**
 * Poll cancel_requested flag at each step boundary.
 * Throws TaskCancelledException if the operator has requested cancellation.
 * Workers must call this at every step boundary — it's a single indexed lookup.
 */
export async function checkCancellation(
  db:        Db,
  taskId:    string,
  companyId: string,
): Promise<void> {
  const [row] = await db
    .select({ cancelRequested: issues.cancelRequested })
    .from(issues)
    .where(and(eq(issues.id, taskId), eq(issues.companyId, companyId)))
    .limit(1);

  if (row?.cancelRequested) {
    logger.info({ taskId }, "checkpoint: cancel_requested=true — throwing TaskCancelledException");
    throw new TaskCancelledException(taskId);
  }
}

/**
 * Resume-or-start helper.
 * Returns the latest checkpoint context, or null for a fresh start.
 * Logs the decision so traces show whether a task was resumed.
 */
export async function resumeOrStart(
  db:        Db,
  taskId:    string,
  companyId: string,
  traceId?:  string,
): Promise<CheckpointContext | null> {
  const checkpoint = await loadLatestCheckpoint(db, taskId, companyId);
  if (checkpoint) {
    logger.info(
      { taskId, stepNumber: checkpoint.stepNumber, traceId },
      "checkpoint: resuming from step",
    );
  } else {
    logger.info({ taskId, traceId }, "checkpoint: fresh start");
  }
  return checkpoint;
}
