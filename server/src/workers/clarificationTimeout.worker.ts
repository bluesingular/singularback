/**
 * server/src/workers/clarificationTimeout.worker.ts
 *
 * Processes clarification.timeout jobs from the "system" queue.
 *
 * Fires after clarificationTimeoutHours if no human reply arrived.
 * - Marks the clarification_request as timed_out
 * - Sets the issue to "blocked" so it surfaces in the CEO Console
 */

import { Worker, type Job } from "bullmq";
import { eq, and } from "drizzle-orm";
import pino from "pino";
import { redisConnectionBlocking } from "../queue/redis.js";
import { clarificationRequests, issues } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import type { ClarificationTimedOutJob } from "../queue/jobs.js";

const logger = pino({ name: "clarification-timeout-worker" });

export function createClarificationTimeoutWorker(db: Db) {
  const worker = new Worker<ClarificationTimedOutJob>(
    "system",
    async (job: Job<ClarificationTimedOutJob>) => {
      if (job.name !== "clarification.timeout") return;

      const { clarificationId, companyId, issueId, traceId } = job.data;
      const log = logger.child({ traceId, clarificationId, companyId });

      // Only act if still pending — a concurrent reply may have already resolved it
      const [request] = await db
        .select({ status: clarificationRequests.status })
        .from(clarificationRequests)
        .where(
          and(
            eq(clarificationRequests.id, clarificationId),
            eq(clarificationRequests.companyId, companyId),
          ),
        )
        .limit(1);

      if (!request || request.status !== "pending") {
        log.info("clarification: already resolved — timeout is a no-op");
        return;
      }

      await db
        .update(clarificationRequests)
        .set({ status: "timed_out", timedOutAt: new Date() })
        .where(eq(clarificationRequests.id, clarificationId));

      await db
        .update(issues)
        .set({ status: "blocked" })
        .where(and(eq(issues.id, issueId), eq(issues.companyId, companyId)));

      log.warn({ issueId }, "clarification: timed out — issue set to blocked");
    },
    {
      connection: redisConnectionBlocking,
      concurrency: 10,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ traceId: job?.data?.traceId, clarificationId: job?.data?.clarificationId, err }, "clarification.timeout job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "clarification-timeout worker connection error");
  });

  return worker;
}
