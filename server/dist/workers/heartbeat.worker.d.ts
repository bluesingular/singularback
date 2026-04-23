/**
 * server/src/workers/heartbeat.worker.ts
 *
 * Processes heartbeat jobs from the "agents" queue.
 * Replaces Paperclip's setInterval polling loop: instead of tickTimers()
 * checking all agents every N seconds, each agent has its own BullMQ job
 * that reschedules itself after execution based on the agent's configured
 * heartbeat interval.
 *
 * Idempotency: BullMQ deduplicates via jobId=heartbeat:{agentId}, so only
 * one pending heartbeat per agent exists at any time. If the job runs twice
 * (retry after failure), wakeup() is safe to call again — it checks agent
 * state and skips if concurrency limit is already at max.
 */
import { Worker } from "bullmq";
export declare const heartbeatWorker: Worker<{
    companyId: string;
    agentId: string;
    triggeredBy: "email" | "manual" | "approval" | "webhook" | "slack" | "scheduler";
}, any, string>;
//# sourceMappingURL=heartbeat.worker.d.ts.map