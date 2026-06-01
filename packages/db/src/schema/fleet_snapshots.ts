/**
 * packages/db/src/schema/fleet_snapshots.ts
 *
 * Gap O — Agent fleet registry.
 * Recomputed every 6 hours. Internal Swwarm team only — never shown to customers.
 * Underperforming agents section is anonymised aggregate (no company name).
 */

import { pgTable, uuid, integer, jsonb, numeric, timestamp, index } from "drizzle-orm/pg-core";

export const fleetSnapshots = pgTable(
  "fleet_snapshots",
  {
    id:                           uuid("id").primaryKey().defaultRandom(),
    totalCompanies:               integer("total_companies").notNull(),
    totalActiveAgents:            integer("total_active_agents").notNull(),
    agentsByStatus:               jsonb("agents_by_status").notNull(),
    skillDeploymentDistribution:  jsonb("skill_deployment_distribution").notNull(),
    modelVersionDistribution:     jsonb("model_version_distribution").notNull(),
    underperformingAgents:        jsonb("underperforming_agents").notNull(),
    globalErrorRate:              numeric("global_error_rate", { precision: 6, scale: 4 }).notNull(),
    computedAt:                   timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    computedAtIdx: index("fleet_snapshots_computed_at_idx").on(t.computedAt),
  }),
);
