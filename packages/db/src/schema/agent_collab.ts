/**
 * packages/db/src/schema/agent_collab.ts
 *
 * AG-1: Mission context — shared working memory for parallel agents on same mission.
 * AG-2: Agent messages — peer communication channel (informational only, no external actions).
 */

import { pgTable, uuid, varchar, text, jsonb, timestamp, index, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { missions } from "./missions.js";

// ── AG-1: Mission context ─────────────────────────────────────────────────────

export const missionContext = pgTable(
  "mission_context",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    missionId:  uuid("mission_id").notNull().references(() => missions.id, { onDelete: "cascade" }),
    companyId:  uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    contextKey: varchar("context_key", { length: 100 }).notNull(),
    value:      jsonb("value").notNull(),
    writtenBy:  uuid("written_by").notNull().references(() => agents.id, { onDelete: "cascade" }),
    writtenAt:  timestamp("written_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    missionIdx:   index("mission_context_mission_idx").on(t.missionId),
    uniqueKey:    unique("mission_context_unique_key").on(t.missionId, t.contextKey),
  }),
);

// ── AG-2: Agent messages ──────────────────────────────────────────────────────

export const agentMessages = pgTable(
  "agent_messages",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    missionId:    uuid("mission_id").notNull().references(() => missions.id, { onDelete: "cascade" }),
    companyId:    uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    fromAgentId:  uuid("from_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    toAgentId:    uuid("to_agent_id").references(() => agents.id, { onDelete: "set null" }),
    content:      text("content").notNull(),
    messageType:  varchar("message_type", { length: 30 }).notNull(),
    repliedAt:    timestamp("replied_at", { withTimezone: true }),
    replyContent: text("reply_content"),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    missionIdx: index("agent_messages_mission_idx").on(t.missionId, t.createdAt),
  }),
);
