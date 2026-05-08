/**
 * G9 — Batch processing schema.
 *
 * batch_runs  — coordinates a fan-out of N parallel items.
 * batch_items — one record per item; tracks input, status, and output.
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";

export const batchRuns = pgTable(
  "batch_runs",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    companyId:        uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    skillType:        text("skill_type").notNull(),
    parentIssueId:    uuid("parent_issue_id").references(() => issues.id, { onDelete: "set null" }),
    agentId:          uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    itemCount:        integer("item_count").notNull(),
    completedCount:   integer("completed_count").notNull().default(0),
    failedCount:      integer("failed_count").notNull().default(0),
    // pending | running | awaiting_approval | approved | rejected
    status:           text("status").notNull().default("pending"),
    createdByUserId:  text("created_by_user_id"),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt:       timestamp("approved_at", { withTimezone: true }),
    createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyStatusIdx: index("batch_runs_company_status_idx").on(t.companyId, t.status),
  }),
);

export const batchItems = pgTable(
  "batch_items",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    batchRunId:  uuid("batch_run_id").notNull().references(() => batchRuns.id, { onDelete: "cascade" }),
    companyId:   uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    issueId:     uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    itemIndex:   integer("item_index").notNull(),
    input:       jsonb("input").notNull(),
    // pending | running | done | failed
    status:      text("status").notNull().default("pending"),
    output:      jsonb("output"),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    batchRunIdx: index("batch_items_batch_run_idx").on(t.batchRunId),
  }),
);
