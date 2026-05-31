/**
 * packages/db/src/schema/security_events.ts
 *
 * C7 — Security events log.
 * Stores injection attempts, scope violations, and PII-in-brief detections.
 */

import { pgTable, uuid, text, jsonb, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const securityEvents = pgTable(
  "security_events",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    taskId:    uuid("task_id").references(() => issues.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    severity:  text("severity").notNull(),
    payload:   jsonb("payload").notNull(),
    resolved:  boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx:    index("security_events_company_idx").on(t.companyId, t.createdAt),
    unresolvedIdx: index("security_events_unresolved_idx").on(t.companyId, t.severity),
  }),
);
