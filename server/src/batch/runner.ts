/**
 * G9 — Batch processing service.
 *
 * Manages the lifecycle of a fan-out batch:
 *   1. createBatch   — inserts batch_run + N batch_items, enqueues N BullMQ jobs
 *   2. onItemComplete — increments counters; fires approval gate when all done
 *   3. approveBatch  — operator approves the whole batch outcome
 *   4. rejectBatch   — operator rejects the whole batch outcome
 *   5. getBatchStatus — returns batch + item summary for the API
 *
 * Single approval gate: once all items are done/failed, the batch transitions to
 * "awaiting_approval". The operator issues ONE approval (or rejection) for the
 * entire set of outcomes — not N individual approvals.
 */

import { eq, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { batchRuns, batchItems } from "@paperclipai/db";
import { emit } from "../queue/emit.js";
import pino from "pino";

const log = pino({ name: "batch-runner" });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateBatchParams {
  companyId:       string;
  skillType:       string;
  agentId?:        string | null;
  parentIssueId?:  string | null;
  createdByUserId?: string | null;
  items:           Record<string, unknown>[];
}

export interface BatchStatus {
  id:              string;
  companyId:       string;
  skillType:       string;
  status:          string;
  itemCount:       number;
  completedCount:  number;
  failedCount:     number;
  createdAt:       Date;
  approvedAt:      Date | null;
  approvedByUserId: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Creates a batch run record, fans out N item records, and enqueues a BullMQ
 * job per item so workers process them in parallel.
 *
 * @returns The newly created batchRunId
 */
export async function createBatch(db: Db, params: CreateBatchParams): Promise<string> {
  const {
    companyId, skillType, agentId, parentIssueId, createdByUserId, items,
  } = params;

  if (items.length === 0) throw new Error("Batch must have at least one item");

  // 1. Insert batch_run (status: running — we enqueue jobs immediately)
  const [run] = await (db as any)
    .insert(batchRuns)
    .values({
      companyId,
      skillType,
      agentId:         agentId ?? null,
      parentIssueId:   parentIssueId ?? null,
      createdByUserId: createdByUserId ?? null,
      itemCount:       items.length,
      status:          "running",
    })
    .returning({ id: batchRuns.id });

  const batchRunId: string = run.id;

  // 2. Insert batch_items
  const itemRows = items.map((input, itemIndex) => ({
    batchRunId,
    companyId,
    itemIndex,
    input,
    status: "pending",
  }));

  const insertedItems = await (db as any)
    .insert(batchItems)
    .values(itemRows)
    .returning({ id: batchItems.id });

  // 3. Enqueue one BullMQ job per item (parallel fan-out)
  await Promise.all(
    insertedItems.map((item: { id: string }, idx: number) =>
      emit.batchExecuteItem({
        batchRunId,
        itemId:    item.id,
        companyId,
        agentId:   agentId ?? null,
        skillType,
        input:     items[idx],
      }),
    ),
  );

  log.info({ batchRunId, itemCount: items.length, companyId }, "batch: fan-out created");
  return batchRunId;
}

/**
 * Called by the batch item worker when an item finishes (done or failed).
 * Increments the appropriate counter and moves the batch to "awaiting_approval"
 * once ALL items have resolved.
 */
export async function onItemComplete(
  db: Db,
  batchRunId: string,
  itemId: string,
  companyId: string,
  outcome: "done" | "failed",
  output?: Record<string, unknown>,
): Promise<void> {
  // Update the item's status and output
  await (db as any)
    .update(batchItems)
    .set({ status: outcome, output: output ?? null })
    .where(
      and(
        eq(batchItems.id, itemId),
        eq(batchItems.batchRunId, batchRunId),
      ),
    );

  // Increment the right counter on the batch run
  const [run] = await (db as any)
    .select({
      itemCount:      batchRuns.itemCount,
      completedCount: batchRuns.completedCount,
      failedCount:    batchRuns.failedCount,
      status:         batchRuns.status,
    })
    .from(batchRuns)
    .where(and(eq(batchRuns.id, batchRunId), eq(batchRuns.companyId, companyId)));

  if (!run || run.status !== "running") return;

  const newCompleted = run.completedCount + (outcome === "done"   ? 1 : 0);
  const newFailed    = run.failedCount    + (outcome === "failed" ? 1 : 0);
  const totalDone    = newCompleted + newFailed;

  const allResolved = totalDone >= run.itemCount;
  const newStatus   = allResolved ? "awaiting_approval" : "running";

  await (db as any)
    .update(batchRuns)
    .set({
      completedCount: newCompleted,
      failedCount:    newFailed,
      status:         newStatus,
      updatedAt:      new Date(),
    })
    .where(eq(batchRuns.id, batchRunId));

  if (allResolved) {
    log.info(
      { batchRunId, completedCount: newCompleted, failedCount: newFailed },
      "batch: all items resolved — awaiting approval",
    );
  }
}

/**
 * Operator approves the batch outcome.
 * All items' outputs are considered accepted.
 */
export async function approveBatch(
  db: Db,
  batchRunId: string,
  companyId: string,
  actorId: string,
): Promise<void> {
  await (db as any)
    .update(batchRuns)
    .set({
      status:           "approved",
      approvedByUserId: actorId,
      approvedAt:       new Date(),
      updatedAt:        new Date(),
    })
    .where(
      and(
        eq(batchRuns.id, batchRunId),
        eq(batchRuns.companyId, companyId),
        eq(batchRuns.status, "awaiting_approval"),
      ),
    );

  log.info({ batchRunId, actorId }, "batch: approved");
}

/**
 * Operator rejects the batch outcome.
 */
export async function rejectBatch(
  db: Db,
  batchRunId: string,
  companyId: string,
  actorId: string,
): Promise<void> {
  await (db as any)
    .update(batchRuns)
    .set({
      status:           "rejected",
      approvedByUserId: actorId,
      approvedAt:       new Date(),
      updatedAt:        new Date(),
    })
    .where(
      and(
        eq(batchRuns.id, batchRunId),
        eq(batchRuns.companyId, companyId),
        eq(batchRuns.status, "awaiting_approval"),
      ),
    );

  log.info({ batchRunId, actorId }, "batch: rejected");
}

/**
 * Returns the batch run record for the status endpoint.
 */
export async function getBatchStatus(
  db: Db,
  batchRunId: string,
  companyId: string,
): Promise<BatchStatus | null> {
  const [run] = await (db as any)
    .select({
      id:              batchRuns.id,
      companyId:       batchRuns.companyId,
      skillType:       batchRuns.skillType,
      status:          batchRuns.status,
      itemCount:       batchRuns.itemCount,
      completedCount:  batchRuns.completedCount,
      failedCount:     batchRuns.failedCount,
      createdAt:       batchRuns.createdAt,
      approvedAt:      batchRuns.approvedAt,
      approvedByUserId: batchRuns.approvedByUserId,
    })
    .from(batchRuns)
    .where(and(eq(batchRuns.id, batchRunId), eq(batchRuns.companyId, companyId)));

  return run ?? null;
}
