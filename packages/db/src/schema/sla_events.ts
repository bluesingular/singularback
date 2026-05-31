/**
 * packages/db/src/schema/sla_events.ts
 *
 * Gap N: SLA breach tracking and compensation events.
 */

import { pgTable, uuid, varchar, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const slaEvents = pgTable(
  "sla_events",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    companyId:      uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    eventType:      varchar("event_type", { length: 40 }).notNull(),
    plan:           varchar("plan", { length: 20 }).notNull(),
    metric:         varchar("metric", { length: 40 }).notNull(),
    thresholdValue: numeric("threshold_value", { precision: 10, scale: 4 }).notNull(),
    actualValue:    numeric("actual_value", { precision: 10, scale: 4 }).notNull(),
    breachMinutes:  numeric("breach_minutes", { precision: 10, scale: 2 }),
    creditDays:     integer("credit_days").notNull().default(0),
    resolvedAt:     timestamp("resolved_at", { withTimezone: true }),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index("sla_events_company_idx").on(t.companyId, t.createdAt),
  }),
);
