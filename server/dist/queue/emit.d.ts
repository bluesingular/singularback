/**
 * server/src/queue/emit.ts
 *
 * Type-safe public API for enqueuing jobs. All code outside the queue module
 * uses only this API. Never import Queue instances directly from queues.ts.
 *
 * Every function maps to one job type and enforces the correct queue,
 * deduplication strategy, and priority.
 */
import type { HeartbeatJob, EmailReceivedJob, TaskApprovedJob, WebhookReceivedJob, MemoryExtractionJob, SkillImprovementJob } from "./jobs.js";
export declare const emit: {
    /**
     * Trigger an agent heartbeat. Uses jobId deduplication so only one pending
     * heartbeat per agent exists at a time. delayMs controls when it runs.
     */
    heartbeat: (data: HeartbeatJob, delayMs?: number) => Promise<import("bullmq").Job<any, any, string>>;
    emailReceived: (data: EmailReceivedJob) => Promise<import("bullmq").Job<any, any, string>>;
    taskApproved: (data: TaskApprovedJob) => Promise<import("bullmq").Job<any, any, string>>;
    webhookReceived: (data: WebhookReceivedJob) => Promise<import("bullmq").Job<any, any, string>>;
    slackEvent: (data: {
        agentId: string;
        companyId: string;
        event: unknown;
    }) => Promise<import("bullmq").Job<any, any, string>>;
    extractMemory: (data: MemoryExtractionJob) => Promise<import("bullmq").Job<any, any, string>>;
    improveSkill: (data: SkillImprovementJob) => Promise<import("bullmq").Job<any, any, string>>;
    scheduleMonthlyReset: (companyId: string) => Promise<import("bullmq").Job<any, any, string>>;
};
//# sourceMappingURL=emit.d.ts.map