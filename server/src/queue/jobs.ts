/**
 * server/src/queue/jobs.ts
 *
 * Zod schemas and TypeScript types for all BullMQ job payloads.
 * Every queue job must be validated against one of these schemas
 * before being processed by a worker.
 */

import { z } from "zod";

// ── P4: Trace ID propagation ──────────────────────────────────────────────────
// Every job payload carries a traceId so all log entries across worker
// boundaries can be correlated. Generated at task creation, never in workers.

export const BaseJobSchema = z.object({
  // optional for backwards compat — new jobs must include traceId explicitly
  traceId: z.string().uuid().optional(),
});

// ── Agent execution jobs ──────────────────────────────────────────────────────

export const HeartbeatJobSchema = BaseJobSchema.extend({
  agentId: z.string().uuid(),
  companyId: z.string().uuid(),
  triggeredBy: z.enum(["scheduler", "email", "slack", "webhook", "approval", "manual"]),
});

export const EmailReceivedJobSchema = BaseJobSchema.extend({
  agentId: z.string().uuid(),
  companyId: z.string().uuid(),
  emailId: z.string(),
  threadId: z.string(),
  from: z.string(),
  subject: z.string(),
  bodyPreview: z.string().max(500),
});

export const TaskApprovedJobSchema = BaseJobSchema.extend({
  taskId: z.string().uuid(),
  agentId: z.string().uuid(),
  companyId: z.string().uuid(),
  approvedBy: z.string().uuid(),
});

const RoutingRuleSchema = z.object({
  condition: z.object({
    field: z.string(),
    op: z.enum(["eq", "contains", "exists"]),
    value: z.string().optional(),
  }).optional(),
  action: z.object({
    type: z.enum(["heartbeat", "log_only"]),
    agentId: z.string().uuid().optional(),
  }),
});

export const WebhookReceivedJobSchema = BaseJobSchema.extend({
  /** UUID of the webhook_endpoints row (null for legacy agentSlug-based routes) */
  endpointId: z.string().uuid().nullable(),
  companyId: z.string().uuid(),
  source: z.string(), // 'indeed' | 'calendly' | 'custom' | etc.
  payload: z.record(z.unknown()),
  receivedAt: z.string().datetime(),
  routingRules: z.array(RoutingRuleSchema).default([]),
});

export type RoutingRule = z.infer<typeof RoutingRuleSchema>;

// ── G5: Human clarification jobs ─────────────────────────────────────────────

export const ClarificationRequestedJobSchema = BaseJobSchema.extend({
  clarificationId: z.string().uuid(),
  companyId:       z.string().uuid(),
  issueId:         z.string().uuid(),
  agentId:         z.string().uuid().nullable(),
  question:        z.string().min(1),
  timeoutHours:    z.number().int().min(1),
});

export const ClarificationTimedOutJobSchema = BaseJobSchema.extend({
  clarificationId: z.string().uuid(),
  companyId:       z.string().uuid(),
  issueId:         z.string().uuid(),
  agentId:         z.string().uuid().nullable(),
});

// ── Background processing jobs ────────────────────────────────────────────────

export const MemoryExtractionJobSchema = BaseJobSchema.extend({
  taskId: z.string().uuid(),
  agentId: z.string().uuid(),
  companyId: z.string().uuid(),
  output: z.string(),
});

export const SkillImprovementJobSchema = BaseJobSchema.extend({
  agentId: z.string().uuid(),
  companyId: z.string().uuid(),
  skillSlug: z.string(),
  triggerReason: z.enum(["quality_degradation", "human_request", "scheduled_review"]),
});

// ── System jobs ───────────────────────────────────────────────────────────────

export const CostResetJobSchema = BaseJobSchema.extend({
  companyId: z.string().uuid(),
});

export const ActivationCheckJobSchema = BaseJobSchema.extend({
  companyId:  z.string().uuid(),
  packSlug:   z.string(),
  triggerKey: z.enum([
    "day_0_seed",
    "day_2_first_task",
    "day_4_milestone",
    "day_6_relationship",
    "day_7_summary",
  ]),
});

// ── G9: Batch processing jobs ─────────────────────────────────────────────────

export const BatchItemExecuteJobSchema = BaseJobSchema.extend({
  batchRunId: z.string().uuid(),
  itemId:     z.string().uuid(),
  companyId:  z.string().uuid(),
  agentId:    z.string().uuid().nullable(),
  skillType:  z.string(),
  input:      z.record(z.unknown()),
});

export const BatchItemCompleteJobSchema = BaseJobSchema.extend({
  batchRunId: z.string().uuid(),
  itemId:     z.string().uuid(),
  companyId:  z.string().uuid(),
  outcome:    z.enum(["done", "failed"]),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type HeartbeatJob = z.infer<typeof HeartbeatJobSchema>;
export type EmailReceivedJob = z.infer<typeof EmailReceivedJobSchema>;
export type TaskApprovedJob = z.infer<typeof TaskApprovedJobSchema>;
export type WebhookReceivedJob = z.infer<typeof WebhookReceivedJobSchema>;
export type MemoryExtractionJob = z.infer<typeof MemoryExtractionJobSchema>;
export type SkillImprovementJob = z.infer<typeof SkillImprovementJobSchema>;
export type CostResetJob = z.infer<typeof CostResetJobSchema>;
export type ActivationCheckJob = z.infer<typeof ActivationCheckJobSchema>;
export type ClarificationRequestedJob = z.infer<typeof ClarificationRequestedJobSchema>;
export type ClarificationTimedOutJob = z.infer<typeof ClarificationTimedOutJobSchema>;
export type BatchItemExecuteJob = z.infer<typeof BatchItemExecuteJobSchema>;
export type BatchItemCompleteJob = z.infer<typeof BatchItemCompleteJobSchema>;
