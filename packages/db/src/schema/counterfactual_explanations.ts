/**
 * packages/db/src/schema/counterfactual_explanations.ts
 * AG-14: Counterfactual explainability — per-task decision explanations.
 */

import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const counterfactualExplanations = pgTable("counterfactual_explanations", {
  id:             uuid("id").primaryKey().defaultRandom(),
  taskId:         uuid("task_id").notNull(),
  companyId:      uuid("company_id").notNull(),
  decision:       text("decision").notNull(),
  keyFactors:     jsonb("key_factors").notNull().default([]),
  counterfactuals: text("counterfactuals").array().notNull().default([]),
  externalSafe:   text("external_safe").array().notNull().default([]),
  internalFull:   text("internal_full").array().notNull().default([]),
  generatedAt:    timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});
