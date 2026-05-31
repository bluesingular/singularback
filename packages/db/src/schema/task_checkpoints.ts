/**
 * packages/db/src/schema/task_checkpoints.ts
 *
 * AG-3: Task checkpoints for long-horizon task resumption.
 * Written after every successful step boundary. Deleted on task completion.
 * On worker restart: resume from latest checkpoint, not from beginning.
 */

import { pgTable, uuid, integer, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const taskCheckpoints = pgTable(
  "task_checkpoints",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    taskId:          uuid("task_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    companyId:       uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    stepNumber:      integer("step_number").notNull(),
    stepName:        varchar("step_name", { length: 100 }).notNull(),
    executionState:  jsonb("execution_state").notNull(),
    contextSnapshot: jsonb("context_snapshot"),
    outputsSoFar:    jsonb("outputs_so_far"),
    createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskStepIdx: index("task_checkpoints_task_step_idx").on(t.taskId, t.stepNumber),
  }),
);
