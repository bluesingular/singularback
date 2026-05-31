/**
 * packages/db/src/schema/integration_query_log.ts
 * AG-12: Audit trail for federated live data queries.
 */

import { pgTable, uuid, varchar, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const integrationQueryLog = pgTable("integration_query_log", {
  id:              uuid("id").primaryKey().defaultRandom(),
  companyId:       uuid("company_id").notNull(),
  taskId:          uuid("task_id"),
  agentId:         uuid("agent_id"),
  integrationSlug: varchar("integration_slug", { length: 60 }).notNull(),
  queryTemplate:   varchar("query_template", { length: 100 }).notNull(),
  gdprRequired:    boolean("gdpr_required").notNull().default(false),
  cached:          boolean("cached").notNull().default(false),
  resultTokens:    integer("result_tokens"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
