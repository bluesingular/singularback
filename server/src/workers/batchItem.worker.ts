/**
 * server/src/workers/batchItem.worker.ts
 *
 * G9 — Batch item processing workers.
 *
 * Two workers, both on the "background" queue:
 *
 * 1. batch.item.execute — processes a single item in a batch run.
 *    For each item: assembles context, runs the skill, calls onItemComplete.
 *    This is a stub that marks items "done" — real skill execution will be
 *    wired in when the skill execution engine is built (uses resolveSkillForTask).
 *
 * 2. batch.item.complete — handles the notification when a batch item finishes.
 *    Calls onItemComplete() to update counters and check if all items resolved.
 *
 * RULE 6: both workers are idempotent — safe to run twice.
 */

import { Worker, type Job } from "bullmq";
import pino from "pino";
import type { Db } from "@paperclipai/db";
import { redisConnectionBlocking } from "../queue/redis.js";
import { onItemComplete } from "../batch/runner.js";
import type { BatchItemExecuteJob, BatchItemCompleteJob } from "../queue/jobs.js";
import { emit } from "../queue/emit.js";

const logger = pino({ name: "batch-item-worker" });

// ── batch.item.execute ────────────────────────────────────────────────────────

export function initBatchItemExecuteWorker(db: Db): Worker {
  const worker = new Worker<BatchItemExecuteJob>(
    "background",
    async (job: Job<BatchItemExecuteJob>) => {
      if (job.name !== "batch.item.execute") return;

      const { batchRunId, itemId, companyId, agentId, skillType, input } = job.data;

      logger.info({ batchRunId, itemId, skillType }, "batch-item: executing");

      let outcome: "done" | "failed" = "done";
      let output: Record<string, unknown> | undefined;

      try {
        // Skill execution placeholder — real implementation calls the LLM
        // via resolveSkillForTask() + context assembly + quality gates.
        // For now: record the input as output so the batch resolves correctly.
        output = { processed: true, input, skillType, agentId };
      } catch (err) {
        logger.error({ batchRunId, itemId, err }, "batch-item: execution failed");
        outcome = "failed";
      }

      // Signal completion — triggers counter update and approval gate check
      await emit.batchItemComplete({ batchRunId, itemId, companyId, outcome });

      logger.info({ batchRunId, itemId, outcome }, "batch-item: complete signal sent");
    },
    { connection: redisConnectionBlocking, concurrency: 10 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, itemId: job?.data?.itemId, err }, "batch-item-execute: job failed");
  });

  return worker;
}

// ── batch.item.complete ───────────────────────────────────────────────────────

export function initBatchItemCompleteWorker(db: Db): Worker {
  const worker = new Worker<BatchItemCompleteJob>(
    "background",
    async (job: Job<BatchItemCompleteJob>) => {
      if (job.name !== "batch.item.complete") return;

      const { batchRunId, itemId, companyId, outcome } = job.data;

      await onItemComplete(db, batchRunId, itemId, companyId, outcome);

      logger.info({ batchRunId, itemId, outcome }, "batch-item-complete: counters updated");
    },
    { connection: redisConnectionBlocking, concurrency: 20 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, batchRunId: job?.data?.batchRunId, err }, "batch-item-complete: job failed");
  });

  return worker;
}
