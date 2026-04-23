/**
 * packages/db/src/schema/gates.ts
 * M6: Quality gates, audit trail, damage control
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

// ── Quality gates ─────────────────────────────────────────────────────────────

export const qualityGates = pgTable("quality_gates", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  agentId:   uuid("agent_id"),   // null = applies to all agents in the company
  gateType:  text("gate_type").notNull(),
  config:    jsonb("config").notNull().$type<Record<string, unknown>>(),
  enabled:   boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Gate violations ───────────────────────────────────────────────────────────

export const gateViolations = pgTable("gate_violations", {
  id:         uuid("id").primaryKey().defaultRandom(),
  companyId:  uuid("company_id").notNull(),
  gateId:     uuid("gate_id").notNull(),
  agentId:    uuid("agent_id"),
  taskId:     uuid("task_id"),
  actionType: text("action_type").notNull(),
  actionData: jsonb("action_data").notNull().$type<Record<string, unknown>>(),
  violation:  text("violation").notNull(),
  resolution: text("resolution"),
  resolvedBy: uuid("resolved_by"),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Immutable audit trail (AI Act Art. 12) ────────────────────────────────────

export const auditEntries = pgTable("audit_entries", {
  id:         uuid("id").primaryKey().defaultRandom(),
  companyId:  uuid("company_id").notNull(),
  agentId:    uuid("agent_id"),
  userId:     uuid("user_id"),
  taskId:     uuid("task_id"),
  actionType: text("action_type").notNull(),
  actionData: jsonb("action_data").notNull().$type<Record<string, unknown>>(),
  result:     text("result").notNull(),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  ipAddress:  text("ip_address"),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Damage control events ─────────────────────────────────────────────────────

export const damageControlEvents = pgTable("damage_control_events", {
  id:              uuid("id").primaryKey().defaultRandom(),
  companyId:       uuid("company_id").notNull(),
  agentId:         uuid("agent_id").notNull(),
  taskId:          uuid("task_id").notNull(),
  errorType:       text("error_type").notNull(),
  status:          text("status").notNull().default("pending"),
  recoveryActions: jsonb("recovery_actions").$type<string[]>(),
  contactName:     text("contact_name"),
  topic:           text("topic"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:      timestamp("resolved_at", { withTimezone: true }),
});
