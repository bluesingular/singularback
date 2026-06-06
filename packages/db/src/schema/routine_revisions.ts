import { pgTable, uuid, text, integer, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { routines } from "./routines.js";
import { agents } from "./agents.js";

export const routineRevisions = pgTable(
  "routine_revisions",
  {
    id:                uuid("id").primaryKey().defaultRandom(),
    routineId:         uuid("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
    companyId:         uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    revisionNumber:    integer("revision_number").notNull(),
    title:             text("title").notNull(),
    description:       text("description"),
    variables:         jsonb("variables").notNull().default([]),
    changedByUserId:   text("changed_by_user_id"),
    changedByAgentId:  uuid("changed_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    changeSummary:     text("change_summary"),
    snapshot:          jsonb("snapshot").notNull().default({}),
    createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    routineRevisionUq: uniqueIndex("routine_revisions_routine_revision_uq").on(table.routineId, table.revisionNumber),
    routineIdx:        index("routine_revisions_routine_idx").on(table.routineId, table.revisionNumber),
  }),
);
