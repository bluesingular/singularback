/**
 * packages/db/src/schema/missions.ts
 *
 * WAR-3: Mission system.
 * Mission = CEO-level strategic intent. CEO creates missions.
 * Orchestrator creates tasks (issues) from missions.
 */

import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";

export const missions = pgTable(
  "missions",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    companyId:     uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    title:         varchar("title", { length: 200 }).notNull(),
    brief:         text("brief").notNull(),
    status:        text("status").notNull().default("active"),
    orchestratorId: uuid("orchestrator_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt:   timestamp("completed_at", { withTimezone: true }),
    archivedAt:    timestamp("archived_at", { withTimezone: true }),
  },
  (t) => ({
    companyStatusIdx: index("missions_company_status_idx").on(t.companyId, t.status),
  }),
);

export const missionMessages = pgTable(
  "mission_messages",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    missionId: uuid("mission_id").notNull().references(() => missions.id, { onDelete: "cascade" }),
    role:      text("role").notNull(),
    content:   text("content").notNull(),
    agentId:   uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    missionIdx: index("mission_messages_mission_idx").on(t.missionId, t.createdAt),
  }),
);

export const missionTasks = pgTable("mission_tasks", {
  missionId: uuid("mission_id").notNull().references(() => missions.id, { onDelete: "cascade" }),
  taskId:    uuid("task_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
});
