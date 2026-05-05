/**
 * server/src/queue/jobs.ts
 *
 * Zod schemas and TypeScript types for all BullMQ job payloads.
 * Every queue job must be validated against one of these schemas
 * before being processed by a worker.
 */
import { z } from "zod";
export declare const HeartbeatJobSchema: z.ZodObject<{
    agentId: z.ZodString;
    companyId: z.ZodString;
    triggeredBy: z.ZodEnum<["scheduler", "email", "slack", "webhook", "approval", "manual"]>;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    agentId: string;
    triggeredBy: "email" | "manual" | "approval" | "webhook" | "slack" | "scheduler";
}, {
    companyId: string;
    agentId: string;
    triggeredBy: "email" | "manual" | "approval" | "webhook" | "slack" | "scheduler";
}>;
export declare const EmailReceivedJobSchema: z.ZodObject<{
    agentId: z.ZodString;
    companyId: z.ZodString;
    emailId: z.ZodString;
    threadId: z.ZodString;
    from: z.ZodString;
    subject: z.ZodString;
    bodyPreview: z.ZodString;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    agentId: string;
    from: string;
    emailId: string;
    threadId: string;
    subject: string;
    bodyPreview: string;
}, {
    companyId: string;
    agentId: string;
    from: string;
    emailId: string;
    threadId: string;
    subject: string;
    bodyPreview: string;
}>;
export declare const TaskApprovedJobSchema: z.ZodObject<{
    taskId: z.ZodString;
    agentId: z.ZodString;
    companyId: z.ZodString;
    approvedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    agentId: string;
    taskId: string;
    approvedBy: string;
}, {
    companyId: string;
    agentId: string;
    taskId: string;
    approvedBy: string;
}>;
export declare const WebhookReceivedJobSchema: z.ZodObject<{
    agentId: z.ZodString;
    companyId: z.ZodString;
    source: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    receivedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    payload: Record<string, unknown>;
    agentId: string;
    source: string;
    receivedAt: string;
}, {
    companyId: string;
    payload: Record<string, unknown>;
    agentId: string;
    source: string;
    receivedAt: string;
}>;
export declare const MemoryExtractionJobSchema: z.ZodObject<{
    taskId: z.ZodString;
    agentId: z.ZodString;
    companyId: z.ZodString;
    output: z.ZodString;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    agentId: string;
    taskId: string;
    output: string;
}, {
    companyId: string;
    agentId: string;
    taskId: string;
    output: string;
}>;
export declare const SkillImprovementJobSchema: z.ZodObject<{
    agentId: z.ZodString;
    companyId: z.ZodString;
    skillSlug: z.ZodString;
    triggerReason: z.ZodEnum<["quality_degradation", "human_request", "scheduled_review"]>;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    agentId: string;
    triggerReason: "quality_degradation" | "human_request" | "scheduled_review";
    skillSlug: string;
}, {
    companyId: string;
    agentId: string;
    triggerReason: "quality_degradation" | "human_request" | "scheduled_review";
    skillSlug: string;
}>;
export declare const CostResetJobSchema: z.ZodObject<{
    companyId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    companyId: string;
}, {
    companyId: string;
}>;
export declare const ActivationCheckJobSchema: z.ZodObject<{
    companyId: z.ZodString;
    packSlug: z.ZodString;
    triggerKey: z.ZodEnum<["day_0_seed", "day_2_first_task", "day_4_milestone", "day_6_relationship", "day_7_summary"]>;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    packSlug: string;
    triggerKey: "day_0_seed" | "day_2_first_task" | "day_4_milestone" | "day_6_relationship" | "day_7_summary";
}, {
    companyId: string;
    packSlug: string;
    triggerKey: "day_0_seed" | "day_2_first_task" | "day_4_milestone" | "day_6_relationship" | "day_7_summary";
}>;
export type HeartbeatJob = z.infer<typeof HeartbeatJobSchema>;
export type EmailReceivedJob = z.infer<typeof EmailReceivedJobSchema>;
export type TaskApprovedJob = z.infer<typeof TaskApprovedJobSchema>;
export type WebhookReceivedJob = z.infer<typeof WebhookReceivedJobSchema>;
export type MemoryExtractionJob = z.infer<typeof MemoryExtractionJobSchema>;
export type SkillImprovementJob = z.infer<typeof SkillImprovementJobSchema>;
export type CostResetJob = z.infer<typeof CostResetJobSchema>;
export type ActivationCheckJob = z.infer<typeof ActivationCheckJobSchema>;
//# sourceMappingURL=jobs.d.ts.map