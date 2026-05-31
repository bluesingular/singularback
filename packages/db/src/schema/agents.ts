import {
  type AnyPgColumn,
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/** The six approved agent colours — immutable after assignment. */
export const AGENT_COLOURS = [
  "#3B82F6", "#10B981", "#F59E0B",
  "#8B5CF6", "#EF4444", "#14B8A6",
] as const;

export type AgentColour  = typeof AGENT_COLOURS[number];
export type AgentStatus  = "active" | "paused" | "deactivated";

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    // WAR-1: immutable system identifier (set at pack install, never changed)
    slug: text("slug").notNull(),
    // WAR-1: customer-facing callsign, editable by operator
    displayName: text("display_name").notNull(),
    // WAR-1: one of 6 approved hex values, immutable after set
    colour: text("colour").notNull().default("#3B82F6"),
    // WAR-1: identity layer — tone, persona, constraints, [[CONSTITUTION]] block
    soulMd: text("soul_md"),
    // WAR-1: whether agent appears in orchestrator team-roster.md
    teamRosterVisible: boolean("team_roster_visible").notNull().default(true),
    // AG-13: whether [[UNCERTAINTY]] block is installed in soul.md
    uncertaintyBlockInstalled: boolean("uncertainty_block_installed").notNull().default(false),
    role: text("role").notNull().default("general"),
    title: text("title"),
    icon: text("icon"),
    // Heartbeat system uses: idle | running | terminated | pending_approval.
    // Swwarm WAR-1 model (active | paused | deactivated) enforced at app layer.
    status: text("status").notNull().default("idle"),
    reportsTo: uuid("reports_to").references((): AnyPgColumn => agents.id),
    capabilities: text("capabilities"),
    adapterType: text("adapter_type").notNull().default("process"),
    adapterConfig: jsonb("adapter_config").$type<Record<string, unknown>>().notNull().default({}),
    runtimeConfig: jsonb("runtime_config").$type<Record<string, unknown>>().notNull().default({}),
    budgetMonthlyCents: integer("budget_monthly_cents").notNull().default(0),
    spentMonthlyCents: integer("spent_monthly_cents").notNull().default(0),
    pauseReason: text("pause_reason"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    permissions: jsonb("permissions").$type<Record<string, unknown>>().notNull().default({}),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx:  index("agents_company_status_idx").on(table.companyId, table.status),
    companyReportsToIdx: index("agents_company_reports_to_idx").on(table.companyId, table.reportsTo),
    companySlugIdx:    uniqueIndex("agents_company_slug_idx").on(table.companyId, table.slug),
  }),
);
