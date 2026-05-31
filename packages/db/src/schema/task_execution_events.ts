/**
 * packages/db/src/schema/task_execution_events.ts
 *
 * F7: Task execution events — reasoning capture.
 * Logs tool calls, reasoning fragments, constitution revisions per task.
 * Never truncated. Accessible via drill-down panel on operator request only.
 */

import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const taskExecutionEvents = pgTable(
  "task_execution_events",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    taskId:    uuid("task_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    content:   text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdx: index("task_execution_events_task_idx").on(t.taskId),
  }),
);
