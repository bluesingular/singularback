/**
 * server/src/workers/taskApproved.worker.ts
 *
 * Processes task.approved jobs from the "agents" queue.
 * When an operator approves a pending action, the agent must execute it
 * immediately — not wait for the next heartbeat interval.
 *
 * G8: Also releases any downstream tasks that were blocked waiting on this task.
 *
 * RULE 7 (APPROVAL FLOW NON-NEGOTIABLE): requires_approval action →
 * approval_requests record → wait for human. This worker fires the moment
 * the human approves, ensuring zero additional delay.
 */

import { Worker, type Job } from "bullmq";
import pino from "pino";
import type { Db } from "@paperclipai/db";
import { redisConnectionBlocking } from "../queue/redis.js";
import { emit } from "../queue/emit.js";
import type { TaskApprovedJob } from "../queue/jobs.js";
import { releaseBlockedTasks } from "../tasks/dag.js";

const logger = pino({ name: "task-approved-worker" });

export function initTaskApprovedWorker(db: Db): Worker {
  const worker = new Worker<TaskApprovedJob>(
    "agents",
    async (job: Job<TaskApprovedJob>) => {
      if (job.name !== "task.approved") return;

      const { taskId, agentId, companyId, approvedBy, traceId } = job.data;
      const log = logger.child({ traceId, taskId, agentId, companyId });

      log.info({ approvedBy }, "task approved: triggering immediate execution");

      // Trigger immediate heartbeat so the agent acts on the approval
      await emit.heartbeat({ agentId, companyId, triggeredBy: "approval" }, 0);

      // G8: Release any downstream tasks that were blocked waiting on this task
      const released = await releaseBlockedTasks(db, taskId, companyId);
      if (released.length > 0) {
        log.info({ released }, "dag: released downstream tasks");
      }
    },
    {
      connection: redisConnectionBlocking,
      concurrency: 10,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ traceId: job?.data?.traceId, taskId: job?.data?.taskId, agentId: job?.data?.agentId, err }, "task.approved job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "task-approved worker connection error");
  });

  return worker;
}
