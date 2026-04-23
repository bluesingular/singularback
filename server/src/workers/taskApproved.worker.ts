/**
 * server/src/workers/taskApproved.worker.ts
 *
 * Processes task.approved jobs from the "agents" queue.
 * When an operator approves a pending action, the agent must execute it
 * immediately — not wait for the next heartbeat interval.
 *
 * RULE 7 (APPROVAL FLOW NON-NEGOTIABLE): requires_approval action →
 * approval_requests record → wait for human. This worker fires the moment
 * the human approves, ensuring zero additional delay.
 */

import { Worker, type Job } from "bullmq";
import pino from "pino";
import { redisConnectionBlocking } from "../queue/redis.js";
import { emit } from "../queue/emit.js";
import type { TaskApprovedJob } from "../queue/jobs.js";

const logger = pino({ name: "task-approved-worker" });

export const taskApprovedWorker = new Worker<TaskApprovedJob>(
  "agents",
  async (job: Job<TaskApprovedJob>) => {
    if (job.name !== "task.approved") return;

    const { taskId, agentId, companyId, approvedBy } = job.data;

    logger.info({ taskId, agentId, approvedBy }, "task approved: triggering immediate execution");

    // Task status update (markApproved) will be implemented via taskService in M7.
    // For now: trigger immediate heartbeat so the agent acts on the approval.
    await emit.heartbeat({ agentId, companyId, triggeredBy: "approval" }, 0);
  },
  {
    connection: redisConnectionBlocking,
    concurrency: 10,
  },
);

taskApprovedWorker.on("failed", (job, err) => {
  logger.error(
    { taskId: job?.data?.taskId, agentId: job?.data?.agentId, err },
    "task.approved job failed",
  );
});

taskApprovedWorker.on("error", (err) => {
  logger.error({ err }, "task-approved worker connection error");
});
