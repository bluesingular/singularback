/**
 * packages/db/src/schema/cost_records.ts
 * M7: Cost intelligence — LLM call cost tracking at micro-euro precision.
 */

import { pgTable, uuid, text, integer, smallint, timestamp } from "drizzle-orm/pg-core";

export const costRecords = pgTable("cost_records", {
  id:           uuid("id").primaryKey().defaultRandom(),
  companyId:    uuid("company_id").notNull(),
  agentId:      uuid("agent_id"),
  taskId:       uuid("task_id"),
  model:        text("model").notNull(),
  tier:         smallint("tier").notNull(),           // 0 | 1 | 2 | 3
  inputTokens:  integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costEurMicro: integer("cost_eur_micro").notNull(), // micro-euros (1 EUR = 1,000,000 micro-EUR)
  billingMonth: text("billing_month").notNull(),     // 'YYYY-MM'
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
