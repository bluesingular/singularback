import {
  pgTable, uuid, text, timestamp, jsonb, customType, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { authUsers } from "./auth.js";

// Drizzle custom type for BYTEA columns (encrypted credential blobs)
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() { return "bytea"; },
});

// ── integrations ──────────────────────────────────────────────────────────────

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("connected"),
    // AES-256-GCM encrypted credential blobs
    credentialsEnc: bytea("credentials_enc").notNull(),
    credentialsIv:  bytea("credentials_iv").notNull(),
    credentialsTag: bytea("credentials_tag").notNull(),
    // OAuth tokens (also encrypted)
    oauthAccessTokenEnc:  bytea("oauth_access_token_enc"),
    oauthRefreshTokenEnc: bytea("oauth_refresh_token_enc"),
    oauthExpiresAt: timestamp("oauth_expires_at", { withTimezone: true }),
    // Metadata
    scopes:        text("scopes").array().notNull().default([]),
    webhookSecret: text("webhook_secret"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyTypeUnique: uniqueIndex("integrations_company_type_idx").on(table.companyId, table.type),
    companyIdx: index("integrations_company_idx").on(table.companyId),
  }),
);

// ── agent_integration_permissions ─────────────────────────────────────────────

export const agentIntegrationPermissions = pgTable(
  "agent_integration_permissions",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    agentId:       uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id").notNull().references(() => integrations.id, { onDelete: "cascade" }),
    permissions:   text("permissions").array().notNull().default([]),
    grantedBy:     text("granted_by").references(() => authUsers.id),
    grantedAt:     timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentIntegUnique: uniqueIndex("agent_integration_perms_unique_idx").on(table.agentId, table.integrationId),
    agentIdx: index("agent_integration_perms_agent_idx").on(table.agentId),
  }),
);

// ── webhook_events ────────────────────────────────────────────────────────────

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    companyId:   uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId:     uuid("agent_id").references(() => agents.id),
    source:      text("source").notNull(),
    payload:     jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status:      text("status").notNull().default("queued"),
    receivedAt:  timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => ({
    companyIdx: index("webhook_events_company_idx").on(table.companyId),
  }),
);

// ── tool_call_log ─────────────────────────────────────────────────────────────

export const toolCallLog = pgTable(
  "tool_call_log",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    companyId:  uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId:    uuid("agent_id").references(() => agents.id),
    taskId:     uuid("task_id"),
    toolType:   text("tool_type").notNull(),
    toolName:   text("tool_name").notNull(),
    input:      jsonb("input").$type<Record<string, unknown>>().notNull(),
    output:     jsonb("output").$type<Record<string, unknown>>(),
    status:     text("status").notNull(),
    durationMs: text("duration_ms"),
    error:      text("error"),
    calledAt:   timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx:  index("tool_call_log_company_idx").on(table.companyId),
    calledAtIdx: index("tool_call_log_called_at_idx").on(table.calledAt),
  }),
);
