/**
 * server/src/queue/jobs.ts
 *
 * Zod schemas and TypeScript types for all BullMQ job payloads.
 * Every queue job must be validated against one of these schemas
 * before being processed by a worker.
 */

import { z } from "zod";

// ── Agent execution jobs ──────────────────────────────────────────────────────

export const HeartbeatJobSchema = z.object({
  agentId: z.string().uuid(),
  companyId: z.string().uuid(),
  triggeredBy: z.enum(["scheduler", "email", "slack", "webhook", "approval", "manual"]),
});

export const EmailReceivedJobSchema = z.object({
  agentId: z.string().uuid(),
  companyId: z.string().uuid(),
  emailId: z.string(),
  threadId: z.string(),
  from: z.string(),
  subject: z.string(),
  bodyPreview: z.string().max(500),
});

export const TaskApprovedJobSchema = z.object({
  taskId: z.string().uuid(),
  agentId: z.string().uuid(),
  companyId: z.string().uuid(),
  approvedBy: z.string().uuid(),
});

export const WebhookReceivedJobSchema = z.object({
  agentId: z.string().uuid(),
  companyId: z.string().uuid(),
  source: z.string(), // 'indeed' | 'calendly' | 'custom' | etc.
  payload: z.record(z.unknown()),
  receivedAt: z.string().datetime(),
});

// ── Background processing jobs ────────────────────────────────────────────────

export const MemoryExtractionJobSchema = z.object({
  taskId: z.string().uuid(),
  agentId: z.string().uuid(),
  companyId: z.string().uuid(),
  output: z.string(),
});

export const SkillImprovementJobSchema = z.object({
  agentId: z.string().uuid(),
  companyId: z.string().uuid(),
  skillSlug: z.string(),
  triggerReason: z.enum(["quality_degradation", "human_request", "scheduled_review"]),
});

// ── System jobs ───────────────────────────────────────────────────────────────

export const CostResetJobSchema = z.object({
  companyId: z.string().uuid(),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type HeartbeatJob = z.infer<typeof HeartbeatJobSchema>;
export type EmailReceivedJob = z.infer<typeof EmailReceivedJobSchema>;
export type TaskApprovedJob = z.infer<typeof TaskApprovedJobSchema>;
export type WebhookReceivedJob = z.infer<typeof WebhookReceivedJobSchema>;
export type MemoryExtractionJob = z.infer<typeof MemoryExtractionJobSchema>;
export type SkillImprovementJob = z.infer<typeof SkillImprovementJobSchema>;
export type CostResetJob = z.infer<typeof CostResetJobSchema>;
