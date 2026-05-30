/**
 * server/src/workers/costReset.worker.ts
 *
 * Processes "cost.reset" jobs from the system queue — M14.
 *
 * Scheduled per-company on the 1st of each month at midnight UTC by
 * emit.scheduleMonthlyReset() (called from bootstrapScheduler).
 *
 * Resets:
 *   - tasksUsedMonth  → 0
 *   - tokensUsedMonth → 0
 *   - billingPeriodStart → now
 *
 * RULE 6: idempotent — if the reset fires twice in the same second
 * (e.g. duplicate webhook), the second run is a no-op because usage
 * counters are already 0 and billingPeriodStart is already updated.
 */

import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import pino from "pino";
import { companies } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { redisConnectionBlocking } from "../queue/redis.js";

const logger = pino({ name: "cost-reset-worker" });

interface CostResetJob {
  companyId: string;
}

export function initCostResetWorker(db: Db): Worker {
  const worker = new Worker<CostResetJob>(
    "system",
    async (job: Job<CostResetJob>) => {
      if (job.name !== "cost.reset") return;

      const { companyId } = job.data;

      await db
        .update(companies)
        .set({
          tasksUsedMonth:     0,
          tokensUsedMonth:    0,
          billingPeriodStart: new Date(),
          updatedAt:          new Date(),
        })
        .where(eq(companies.id, companyId));

      logger.info({ companyId }, "cost-reset: monthly usage counters reset");
    },
    { connection: redisConnectionBlocking, concurrency: 5 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, companyId: job?.data?.companyId, err }, "cost-reset: job failed");
  });

  return worker;
}
