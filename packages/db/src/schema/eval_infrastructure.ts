/**
 * packages/db/src/schema/eval_infrastructure.ts
 * §31.4 AI Evaluation Infrastructure + §31.5 Embedding Metrics + §11.6 Away Mode
 */

import { pgTable, uuid, varchar, text, boolean, decimal, integer, jsonb, date, timestamp } from "drizzle-orm/pg-core";

export const hallucinationChecks = pgTable("hallucination_checks", {
  id:         uuid("id").primaryKey().defaultRandom(),
  taskId:     uuid("task_id").notNull(),
  companyId:  uuid("company_id").notNull(),
  outputId:   varchar("output_id", { length: 100 }).notNull(),
  claim:      text("claim").notNull(),
  source:     text("source"),
  verdict:    varchar("verdict", { length: 20 }).notNull(),
  confidence: decimal("confidence", { precision: 4, scale: 3 }).notNull(),
  blocked:    boolean("blocked").notNull().default(false),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const skillRegressionResults = pgTable("skill_regression_results", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  skillId:              uuid("skill_id").notNull(),
  companyId:            uuid("company_id").notNull(),
  versionCandidate:     varchar("version_candidate", { length: 20 }).notNull(),
  versionBaseline:      varchar("version_baseline", { length: 20 }).notNull(),
  examplesRun:          integer("examples_run").notNull(),
  avgQualityCandidate:  decimal("avg_quality_candidate", { precision: 4, scale: 2 }).notNull(),
  avgQualityBaseline:   decimal("avg_quality_baseline",  { precision: 4, scale: 2 }).notNull(),
  delta:                decimal("delta", { precision: 4, scale: 2 }).notNull(),
  promoted:             boolean("promoted").notNull().default(false),
  blockedReason:        text("blocked_reason"),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const autonomySafetyEvals = pgTable("autonomy_safety_evals", {
  id:              uuid("id").primaryKey().defaultRandom(),
  skillId:         uuid("skill_id").notNull(),
  companyId:       uuid("company_id").notNull(),
  currentTier:     varchar("current_tier",  { length: 20 }).notNull(),
  proposedTier:    varchar("proposed_tier", { length: 20 }).notNull(),
  edgeCasesRun:    integer("edge_cases_run").notNull().default(0),
  safeResponses:   integer("safe_responses").notNull().default(0),
  unsafeResponses: integer("unsafe_responses").notNull().default(0),
  safetyRate:      decimal("safety_rate", { precision: 4, scale: 3 }).notNull().default("0"),
  passed:          boolean("passed").notNull().default(false),
  blockingCases:   jsonb("blocking_cases").notNull().default([]),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memoryCorrectnessTests = pgTable("memory_correctness_tests", {
  id:             uuid("id").primaryKey().defaultRandom(),
  companyId:      uuid("company_id").notNull(),
  query:          text("query").notNull(),
  expectedAnswer: text("expected_answer").notNull(),
  actualAnswer:   text("actual_answer"),
  matchScore:     decimal("match_score", { precision: 4, scale: 3 }),
  passed:         boolean("passed").notNull().default(false),
  runAt:          timestamp("run_at",      { withTimezone: true }).notNull().defaultNow(),
  createdAt:      timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
});

export const embeddingMetrics = pgTable("embedding_metrics", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  companyId:            uuid("company_id").notNull(),
  weekStart:            date("week_start").notNull(),
  tasksByAgent:         jsonb("tasks_by_agent").notNull().default({}),
  distinctWorkflowTypes: integer("distinct_workflow_types").notNull().default(0),
  humanTimeSavedHours:  decimal("human_time_saved_hours", { precision: 8, scale: 2 }).notNull().default("0"),
  autonomousTaskPct:    decimal("autonomous_task_pct",    { precision: 5, scale: 2 }).notNull().default("0"),
  embeddingScore:       decimal("embedding_score",        { precision: 5, scale: 2 }).notNull().default("0"),
  computedAt:           timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const awayMode = pgTable("away_mode", {
  id:             uuid("id").primaryKey().defaultRandom(),
  companyId:      uuid("company_id").notNull(),
  userId:         text("user_id").notNull(),
  startsAt:       timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt:         timestamp("ends_at",   { withTimezone: true }).notNull(),
  briefingMd:     text("briefing_md"),
  briefingReady:  boolean("briefing_ready").notNull().default(false),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
