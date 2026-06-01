/**
 * server/src/fleet/snapshot.ts
 *
 * Gap O — Agent fleet registry.
 *
 * Computes and persists a FleetSnapshot every 6 hours via BullMQ.
 * Internal Swwarm team tool — never exposed to customers.
 * Underperforming agents are anonymised aggregate only (no company name).
 *
 * Retention: keeps the 48 most recent snapshots (8 days at 6h cadence).
 */

import { desc, sql, lt, count } from "drizzle-orm";
import { fleetSnapshots, companies, agents, companySkills, issues, judgeResults } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "fleet-snapshot" });

const RETENTION_COUNT = 48;

export interface FleetSnapshot {
  total_companies:               number;
  total_active_agents:           number;
  agents_by_status:              { active: number; paused: number; deactivated: number };
  skill_deployment_distribution: { skill_slug: string; company_count: number }[];
  model_version_distribution:    { model: string; skill_count: number }[];
  underperforming_agents:        { skill_slug: string; avg_judge_score: number; company_count: number }[];
  global_error_rate:             number;
  computed_at:                   Date;
}

export async function computeAndPersistFleetSnapshot(db: Db): Promise<FleetSnapshot> {
  logger.info("gap-o: computing fleet snapshot");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    companyCount,
    agentStatusRows,
    skillDistRows,
    judgeRows,
    errorRateRow,
  ] = await Promise.all([
    // Total companies
    db.select({ n: count() }).from(companies).then((r) => r[0]?.n ?? 0),

    // Agents by status
    db
      .select({ status: agents.status, n: count() })
      .from(agents)
      .groupBy(agents.status),

    // Skill deployment: how many companies have each skill slug installed
    db
      .select({
        slug:         companySkills.slug,
        companyCount: sql<number>`count(distinct ${companySkills.companyId})`,
      })
      .from(companySkills)
      .groupBy(companySkills.slug)
      .orderBy(sql`count(distinct ${companySkills.companyId}) desc`),

    // Underperforming agents: avg judge score < 6.0, last 7 days, grouped by skill slug
    // Anonymised — no company name
    db.execute(sql`
      SELECT
        cs.slug AS skill_slug,
        AVG(jr.overall_score::float)  AS avg_judge_score,
        COUNT(DISTINCT jr.company_id) AS company_count
      FROM judge_results jr
      JOIN company_skills cs
        ON cs.company_id = jr.company_id
      WHERE jr.created_at >= ${sevenDaysAgo}
      GROUP BY cs.slug
      HAVING AVG(jr.overall_score::float) < 6.0
      ORDER BY AVG(jr.overall_score::float) ASC
      LIMIT 20
    `),

    // Global error rate: failed_permanent / total tasks, last 7 days
    db
      .select({
        total:   count(),
        failed:  sql<number>`count(*) filter (where ${issues.failureReason} = 'failed_permanent')`,
      })
      .from(issues)
      .where(sql`${issues.createdAt} >= ${sevenDaysAgo}`),
  ]);

  // Agents by status map
  const agentsByStatus = { active: 0, paused: 0, deactivated: 0 };
  let totalActive = 0;
  for (const row of agentStatusRows) {
    const s = row.status as string;
    if (s === "active")      { agentsByStatus.active      = Number(row.n); totalActive = Number(row.n); }
    if (s === "paused")       agentsByStatus.paused       = Number(row.n);
    if (s === "deactivated")  agentsByStatus.deactivated  = Number(row.n);
  }

  // Model version distribution — read from company_skills metadata JSONB if present,
  // otherwise fall back to a single "default" entry
  const modelDistRows = await db.execute(sql`
    SELECT
      COALESCE(metadata->>'model_version', 'default') AS model,
      COUNT(*) AS skill_count
    FROM company_skills
    GROUP BY COALESCE(metadata->>'model_version', 'default')
    ORDER BY COUNT(*) DESC
  `);

  const totalRow = errorRateRow[0];
  const total   = Number(totalRow?.total  ?? 0);
  const failed  = Number((totalRow as Record<string, unknown>)?.failed ?? 0);
  const globalErrorRate = total > 0 ? failed / total : 0;

  const snapshot: FleetSnapshot = {
    total_companies:               Number(companyCount),
    total_active_agents:           totalActive,
    agents_by_status:              agentsByStatus,
    skill_deployment_distribution: skillDistRows.map((r) => ({
      skill_slug:    String(r.slug),
      company_count: Number(r.companyCount),
    })),
    model_version_distribution: (modelDistRows as unknown as Record<string, unknown>[]).map((r) => ({
      model:       String(r.model ?? "default"),
      skill_count: Number(r.skill_count ?? 0),
    })),
    underperforming_agents: (judgeRows as unknown as Record<string, unknown>[]).map((r) => ({
      skill_slug:      String(r.skill_slug ?? ""),
      avg_judge_score: Number(r.avg_judge_score ?? 0),
      company_count:   Number(r.company_count ?? 0),
    })),
    global_error_rate: globalErrorRate,
    computed_at:       new Date(),
  };

  // Persist
  await db.insert(fleetSnapshots).values({
    totalCompanies:              snapshot.total_companies,
    totalActiveAgents:           snapshot.total_active_agents,
    agentsByStatus:              snapshot.agents_by_status,
    skillDeploymentDistribution: snapshot.skill_deployment_distribution,
    modelVersionDistribution:    snapshot.model_version_distribution,
    underperformingAgents:       snapshot.underperforming_agents,
    globalErrorRate:             String(snapshot.global_error_rate),
    computedAt:                  snapshot.computed_at,
  });

  // Prune old snapshots — keep only RETENTION_COUNT most recent
  const oldest = await db
    .select({ computedAt: fleetSnapshots.computedAt })
    .from(fleetSnapshots)
    .orderBy(desc(fleetSnapshots.computedAt))
    .offset(RETENTION_COUNT)
    .limit(1);

  if (oldest.length > 0) {
    await db.delete(fleetSnapshots).where(
      lt(fleetSnapshots.computedAt, oldest[0].computedAt),
    );
  }

  logger.info(
    {
      companies: snapshot.total_companies,
      agents:    snapshot.total_active_agents,
      errorRate: snapshot.global_error_rate.toFixed(4),
    },
    "gap-o: fleet snapshot persisted",
  );

  return snapshot;
}

/** Fetch the most recent persisted snapshot. Returns null if none computed yet. */
export async function getLatestFleetSnapshot(db: Db): Promise<FleetSnapshot | null> {
  const row = await db.query.fleetSnapshots.findFirst({
    orderBy: (t, { desc: d }) => [d(t.computedAt)],
  });
  if (!row) return null;

  return {
    total_companies:               row.totalCompanies,
    total_active_agents:           row.totalActiveAgents,
    agents_by_status:              row.agentsByStatus as FleetSnapshot["agents_by_status"],
    skill_deployment_distribution: row.skillDeploymentDistribution as FleetSnapshot["skill_deployment_distribution"],
    model_version_distribution:    row.modelVersionDistribution    as FleetSnapshot["model_version_distribution"],
    underperforming_agents:        row.underperformingAgents       as FleetSnapshot["underperforming_agents"],
    global_error_rate:             Number(row.globalErrorRate),
    computed_at:                   row.computedAt,
  };
}
