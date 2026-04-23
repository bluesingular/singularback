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
import type {
  HeartbeatJob,
  EmailReceivedJob,
  TaskApprovedJob,
  WebhookReceivedJob,
  MemoryExtractionJob,
  SkillImprovementJob,
} from "./jobs.js";

export const emit = {
  // ── Agent triggers ──────────────────────────────────────────────────────────

  /**
   * Trigger an agent heartbeat. Uses jobId deduplication so only one pending
   * heartbeat per agent exists at a time. delayMs controls when it runs.
   */
  heartbeat: async (data: HeartbeatJob, delayMs = 0) =>
    agentQueue.add("heartbeat", data, {
      delay: delayMs,
      // BullMQ jobId deduplication: if a heartbeat job already exists for this
      // agent, this call is a no-op (the pending job remains unchanged).
      jobId: `heartbeat:${data.agentId}`,
    }),

  emailReceived: async (data: EmailReceivedJob) =>
    agentQueue.add("email.received", data, {
      priority: 10, // higher priority than scheduled heartbeats
      jobId: `email:${data.emailId}`, // deduplicate if webhook fires twice
    }),

  taskApproved: async (data: TaskApprovedJob) =>
    agentQueue.add("task.approved", data, {
      priority: 10,
      jobId: `approval:${data.taskId}`,
    }),

  webhookReceived: async (data: WebhookReceivedJob) =>
    agentQueue.add("webhook.received", data, {
      priority: 5,
    }),

  slackEvent: async (data: { agentId: string; companyId: string; event: unknown }) =>
    agentQueue.add("slack.event", data, { priority: 8 }),

  // ── Background jobs ─────────────────────────────────────────────────────────

  extractMemory: async (data: MemoryExtractionJob) =>
    backgroundQueue.add("memory.extract", data),

  improveSkill: async (data: SkillImprovementJob) =>
    backgroundQueue.add("skill.improve", data, {
      // One active improvement job per agent-skill pair at a time
      jobId: `skill-improve:${data.agentId}:${data.skillSlug}`,
    }),

  // ── System jobs ─────────────────────────────────────────────────────────────

  scheduleMonthlyReset: async (companyId: string) =>
    systemQueue.add(
      "cost.reset",
      { companyId },
      {
        repeat: { pattern: "0 0 1 * *" }, // 1st of every month at midnight UTC
        jobId: `cost-reset:${companyId}`,
      },
    ),
};
