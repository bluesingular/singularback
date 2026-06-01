/**
 * packages/db/src/schema/agentic_learning.ts
 *
 * AG-6: Procedural patterns — agents learn HOW to do things.
 * AG-7: Outcome attributions — links business outcomes to agent decisions.
 * AG-10: Behavioral baselines + anomaly detection.
 * AG-11: Company narrative — cross-session coherence.
 * Gap A: Skill variance metrics — non-determinism debugging.
 * Gap D: Skill model pins — model upgrade resilience.
 * Gap G: Agent proposals — proactive task suggestions.
 */

import {
  pgTable, uuid, text, varchar, boolean, integer, decimal, numeric,
  date, timestamp, jsonb, index, unique,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";
import { missions } from "./missions.js";
import { goals } from "./goals.js";
import { companySkills } from "./company_skills.js";

// ── AG-6 ─────────────────────────────────────────────────────────────────────

export const proceduralPatterns = pgTable(
  "procedural_patterns",
  {
    id:                 uuid("id").primaryKey().defaultRandom(),
    companyId:          uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    skillId:            uuid("skill_id").references(() => companySkills.id, { onDelete: "cascade" }),
    agentId:            uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    patternDescription: text("pattern_description").notNull(),
    triggerCondition:   text("trigger_condition").notNull(),
    behaviour:          text("behaviour").notNull(),
    outcomeLift:        decimal("outcome_lift", { precision: 5, scale: 2 }),
    sampleSize:         integer("sample_size"),
    confidence:         decimal("confidence", { precision: 4, scale: 3 }),
    source:             varchar("source", { length: 30 }).notNull(),
    active:             boolean("active").notNull().default(true),
    createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ companyIdx: index("procedural_patterns_company_idx").on(t.companyId, t.skillId) }),
);

// ── AG-7 ─────────────────────────────────────────────────────────────────────

export const outcomeAttributions = pgTable(
  "outcome_attributions",
  {
    id:                uuid("id").primaryKey().defaultRandom(),
    companyId:         uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    missionId:         uuid("mission_id").references(() => missions.id, { onDelete: "set null" }),
    taskId:            uuid("task_id").references(() => issues.id, { onDelete: "cascade" }),
    agentId:           uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    skillId:           uuid("skill_id").references(() => companySkills.id, { onDelete: "set null" }),
    outcomeValue:      varchar("outcome_value", { length: 20 }).notNull(),
    contributionScore: decimal("contribution_score", { precision: 4, scale: 3 }),
    keyDecision:       text("key_decision"),
    createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ companyIdx: index("outcome_attributions_company_idx").on(t.companyId, t.createdAt) }),
);

// ── AG-10 ─────────────────────────────────────────────────────────────────────

export const behavioralBaselines = pgTable(
  "behavioral_baselines",
  {
    id:                 uuid("id").primaryKey().defaultRandom(),
    skillId:            uuid("skill_id").notNull().references(() => companySkills.id, { onDelete: "cascade" }),
    companyId:          uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    avgJudgeScore:      numeric("avg_judge_score", { precision: 4, scale: 2 }),
    avgOutputTokens:    integer("avg_output_tokens"),
    avgToolCalls:       numeric("avg_tool_calls", { precision: 4, scale: 2 }),
    avgExecutionMs:     integer("avg_execution_ms"),
    approvalRate:       numeric("approval_rate", { precision: 4, scale: 3 }),
    recycleRate:        numeric("recycle_rate", { precision: 4, scale: 3 }),
    baselineTaskCount:  integer("baseline_task_count"),
    establishedAt:      timestamp("established_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ unique: unique("behavioral_baselines_unique").on(t.skillId, t.companyId) }),
);

export const behavioralAnomalies = pgTable(
  "behavioral_anomalies",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    skillId:      uuid("skill_id").notNull().references(() => companySkills.id, { onDelete: "cascade" }),
    companyId:    uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    metric:       varchar("metric", { length: 50 }).notNull(),
    baselineVal:  numeric("baseline_val", { precision: 10, scale: 4 }),
    currentVal:   numeric("current_val", { precision: 10, scale: 4 }),
    deviationPct: numeric("deviation_pct", { precision: 6, scale: 2 }),
    severity:     varchar("severity", { length: 20 }).notNull(),
    resolved:     boolean("resolved").notNull().default(false),
    detectedAt:   timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ companyIdx: index("behavioral_anomalies_company_idx").on(t.companyId, t.detectedAt) }),
);

// ── AG-11 ─────────────────────────────────────────────────────────────────────

export const companyNarrative = pgTable(
  "company_narrative",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    companyId:   uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd:   date("period_end").notNull(),
    narrativeMd: text("narrative_md").notNull(),
    keyEvents:   jsonb("key_events").notNull().default([]),
    momentum:    varchar("momentum", { length: 20 }).notNull(),
    focusAreas:  text("focus_areas").array().notNull().default([]),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ companyIdx: index("company_narrative_company_idx").on(t.companyId, t.periodStart) }),
);

// ── Gap A ─────────────────────────────────────────────────────────────────────

export const skillVarianceMetrics = pgTable(
  "skill_variance_metrics",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    skillId:        uuid("skill_id").notNull().references(() => companySkills.id, { onDelete: "cascade" }),
    companyId:      uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    periodStart:    date("period_start").notNull(),
    judgeScoreMean: numeric("judge_score_mean", { precision: 4, scale: 2 }),
    judgeScoreStd:  numeric("judge_score_std", { precision: 4, scale: 2 }),
    varianceFlag:   boolean("variance_flag").notNull().default(false),
    computedAt:     timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ companyIdx: index("skill_variance_company_idx").on(t.companyId, t.skillId) }),
);

// ── Gap D ─────────────────────────────────────────────────────────────────────

export const skillModelPins = pgTable(
  "skill_model_pins",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    skillId:      uuid("skill_id").notNull().references(() => companySkills.id, { onDelete: "cascade" }),
    companyId:    uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    modelVersion: varchar("model_version", { length: 100 }).notNull(),
    pinnedReason: varchar("pinned_reason", { length: 50 }).notNull(),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniquePin: unique("skill_model_pins_unique").on(t.skillId, t.companyId) }),
);

// ── Gap G ─────────────────────────────────────────────────────────────────────

export const agentProposals = pgTable(
  "agent_proposals",
  {
    id:                uuid("id").primaryKey().defaultRandom(),
    companyId:         uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    proposingAgentId:  uuid("proposing_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    proposedAgentId:   uuid("proposed_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    trigger:           text("trigger").notNull(),
    proposedTaskBrief: text("proposed_task_brief").notNull(),
    estimatedValue:    text("estimated_value").notNull(),
    urgency:           varchar("urgency", { length: 20 }).notNull(),
    status:            varchar("status", { length: 20 }).notNull().default("pending"),
    declineCount:      integer("decline_count").notNull().default(0),
    expiresAt:         timestamp("expires_at", { withTimezone: true }).notNull(),
    decidedAt:         timestamp("decided_at", { withTimezone: true }),
    createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ companyIdx: index("agent_proposals_company_idx").on(t.companyId, t.status, t.expiresAt) }),
);
