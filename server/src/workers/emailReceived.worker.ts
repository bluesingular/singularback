/**
 * server/src/workers/emailReceived.worker.ts
 *
 * Processes email.received jobs from the "agents" queue.
 * When an email arrives via webhook, this worker triggers an immediate
 * heartbeat for the target agent so it picks up the email without waiting
 * for its next scheduled interval.
 *
 * Full email fetching and task creation (via Integration Hub) will be
 * implemented in M4. For now: validate the payload and trigger wakeup.
 */

import { Worker, type Job } from "bullmq";
import pino from "pino";
import { redisConnectionBlocking } from "../queue/redis.js";
import { emit } from "../queue/emit.js";
import type { EmailReceivedJob } from "../queue/jobs.js";

const logger = pino({ name: "email-received-worker" });

export const emailWorker = new Worker<EmailReceivedJob>(
  "agents",
  async (job: Job<EmailReceivedJob>) => {
    if (job.name !== "email.received") return;

    const { agentId, companyId, emailId, subject } = job.data;

    logger.info({ agentId, emailId, subject }, "email received: triggering immediate heartbeat");

    // Trigger an immediate heartbeat (delay = 0) so the agent processes
    // the email now rather than at its next scheduled interval.
    // Full email fetching and reactive task creation happens in M4.
    await emit.heartbeat({ agentId, companyId, triggeredBy: "email" }, 0);
  },
  {
    connection: redisConnectionBlocking,
    concurrency: 10,
  },
);

emailWorker.on("failed", (job, err) => {
  logger.error(
    { agentId: job?.data?.agentId, emailId: job?.data?.emailId, err },
    "email.received job failed",
  );
});

emailWorker.on("error", (err) => {
  logger.error({ err }, "email worker connection error");
});
