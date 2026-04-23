/**
 * server/src/queue/emit.ts
 *
 * Type-safe public API for enqueuing jobs. All code outside the queue module
 * uses only this API. Never import Queue instances directly from queues.ts.
 *
 * Every function maps to one job type and enforces the correct queue,
 * deduplication strategy, and priority.
 */
import { agentQueue, backgroundQueue, systemQueue } from "./queues.js";
export const emit = {
    // ── Agent triggers ──────────────────────────────────────────────────────────
    /**
     * Trigger an agent heartbeat. Uses jobId deduplication so only one pending
     * heartbeat per agent exists at a time. delayMs controls when it runs.
     */
    heartbeat: async (data, delayMs = 0) => agentQueue.add("heartbeat", data, {
        delay: delayMs,
        // BullMQ jobId deduplication: if a heartbeat job already exists for this
        // agent, this call is a no-op (the pending job remains unchanged).
        jobId: `heartbeat:${data.agentId}`,
    }),
    emailReceived: async (data) => agentQueue.add("email.received", data, {
        priority: 10, // higher priority than scheduled heartbeats
        jobId: `email:${data.emailId}`, // deduplicate if webhook fires twice
    }),
    taskApproved: async (data) => agentQueue.add("task.approved", data, {
        priority: 10,
        jobId: `approval:${data.taskId}`,
    }),
    webhookReceived: async (data) => agentQueue.add("webhook.received", data, {
        priority: 5,
    }),
    slackEvent: async (data) => agentQueue.add("slack.event", data, { priority: 8 }),
    // ── Background jobs ─────────────────────────────────────────────────────────
    extractMemory: async (data) => backgroundQueue.add("memory.extract", data),
    improveSkill: async (data) => backgroundQueue.add("skill.improve", data, {
        // One active improvement job per agent-skill pair at a time
        jobId: `skill-improve:${data.agentId}:${data.skillSlug}`,
    }),
    // ── System jobs ─────────────────────────────────────────────────────────────
    scheduleMonthlyReset: async (companyId) => systemQueue.add("cost.reset", { companyId }, {
        repeat: { pattern: "0 0 1 * *" }, // 1st of every month at midnight UTC
        jobId: `cost-reset:${companyId}`,
    }),
};
//# sourceMappingURL=emit.js.map