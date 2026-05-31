/**
 * packages/db/src/schema/judge_results.ts
 *
 * C8 — LLM-as-judge evaluation results.
 * One row per output version per task.
 */

import { pgTable, uuid, integer, text, numeric, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const judgeResults = pgTable(
  "judge_results",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    companyId:     uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    taskId:        uuid("task_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    outputVersion: integer("output_version").notNull().default(1),
    judgeModel:    text("judge_model").notNull(),
    dimensions:    jsonb("dimensions").notNull(),
    overallScore:  numeric("overall_score", { precision: 4, scale: 2 }).notNull(),
    autoRecycled:  boolean("auto_recycled").notNull().default(false),
    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdx: index("judge_results_task_idx").on(t.taskId, t.outputVersion),
  }),
);
