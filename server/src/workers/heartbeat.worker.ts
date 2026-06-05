/**
 * server/src/workers/heartbeat.worker.ts
 *
 * Processes "heartbeat" jobs from the "agents" BullMQ queue.
 *
 * This is the critical bridge between emit.heartbeat() (which enqueues a
 * BullMQ job) and heartbeatService.wakeup() (which actually runs the agent).
 *
 * Without this worker, "heartbeat" jobs land in the "agents" queue but get
 * silently completed by other workers (emailReceived, taskApproved, etc.)
 * that have early-return guards for their own job names. Agents never execute.
 *
 * Flow:
 *   1. emit.heartbeat() → BullMQ "heartbeat" job in "agents" queue
 *   2. This worker picks it up
 *   3. Calls heartbeatService.wakeup(agentId, ...) → creates heartbeatRun in DB
 *   4. heartbeatService executes the agent run asynchronously
 *
 * Re-scheduling:
 *   The heartbeatService handles its own internal scheduling via the DB
 *   heartbeatRuns table and setInterval in index.ts. BullMQ heartbeat jobs
 *   are for one-off immediate wakeups (from seed tasks, email, approval, etc.).
 *   Periodic scheduled heartbeats come from bootstrapScheduler + tickTimers.
 *
 * RULE 6: idempotent — BullMQ deduplicates via jobId "heartbeat:{agentId}",
 * so only one pending heartbeat per agent exists at a time.
 */

import { Worker, type Job } from "bullmq";
import pino from "pino";
import type { Db } from "@paperclipai/db";
import { redisConnectionBlocking } from "../queue/redis.js";
import { heartbeatService } from "../services/heartbeat.js";
import type { HeartbeatJob } from "../queue/jobs.js";
import { enforceCompanyConcurrency, CompanyConcurrencyLimitError } from "../safety/concurrency.js";

const logger = pino({ name: "heartbeat-worker" });

export function initHeartbeatWorker(db: Db): Worker {
  const svc = heartbeatService(db);

  const worker = new Worker<HeartbeatJob>(
    "heartbeats",
    async (job: Job<HeartbeatJob>) => {
      const { agentId, companyId, triggeredBy, traceId } = job.data;
      const log = logger.child({ traceId, agentId, companyId });

      log.info({ triggeredBy }, "heartbeat-worker: waking agent");

      try {
        // C4: enforce per-company concurrency limit before starting new work
        await enforceCompanyConcurrency(db, companyId);

        const triggerDetailMap: Record<string, "manual" | "ping" | "callback" | "system"> = {
          manual: "manual", scheduler: "system", email: "callback",
          approval: "callback", webhook: "callback", slack: "callback",
        };
        const run = await svc.wakeup(agentId, {
          source: triggeredBy === "scheduler" ? "timer" : "on_demand",
          triggerDetail: triggerDetailMap[triggeredBy] ?? "system",
          reason: `heartbeat_${triggeredBy}`,
          requestedByActorType: "system",
          requestedByActorId: `heartbeat_worker:${triggeredBy}`,
        });

        if (run) {
          log.info({ runId: run.id, triggeredBy }, "heartbeat-worker: run queued");
        } else {
          log.debug({ triggeredBy }, "heartbeat-worker: wakeup skipped (agent busy or no work)");
        }
      } catch (err) {
        if (err instanceof CompanyConcurrencyLimitError) {
          // C4: not an error — company is at capacity, BullMQ will retry
          log.info({ limit: err.limit, active: err.active }, "heartbeat-worker: concurrency limit — requeuing");
          throw err;
        }
        log.error({ triggeredBy, err }, "heartbeat-worker: wakeup failed");
        throw err;
      }
    },
    {
      connection: redisConnectionBlocking,
      concurrency: 10,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, traceId: job?.data?.traceId, agentId: job?.data?.agentId, err }, "heartbeat-worker: job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "heartbeat-worker: worker connection error");
  });

  return worker;
}
