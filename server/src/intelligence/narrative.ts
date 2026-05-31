/**
 * server/src/intelligence/narrative.ts
 *
 * AG-11 — Cross-session narrative coherence.
 *
 * Monthly generation job that synthesises:
 *   - Mission history (completed/archived missions this period)
 *   - Goal progress (goals updated this period)
 *   - Outcome attributions (positive vs negative missions)
 *   - Cost trends
 *
 * Produces a company_narrative record injected into the orchestrator preamble
 * via the {company_narrative} token — gives the orchestrator context of the
 * company's story above individual tasks.
 *
 * Run schedule: first day of each month (monthly BullMQ repeatable job).
 * Company isolation: each company gets its own narrative record.
 */

import { and, eq, gte, lte, desc, sql, count } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companyNarrative,
  missions,
  goals,
  outcomeAttributions,
  costRecords,
} from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "narrative" });

export type Momentum = "accelerating" | "stable" | "decelerating";

export interface NarrativeResult {
  companyId:   string;
  periodStart: Date;
  periodEnd:   Date;
  momentum:    Momentum;
}

// ── generateNarrative ─────────────────────────────────────────────────────────

/**
 * Generate a company_narrative record for a completed calendar month.
 * Upsert behaviour: if a narrative already exists for this period, skip.
 */
export async function generateNarrative(
  db:          Db,
  companyId:   string,
  periodStart: Date,
  periodEnd:   Date,
): Promise<NarrativeResult | null> {
  // Skip if narrative already exists for this period
  const existing = await (db as any)
    .select({ id: companyNarrative.id })
    .from(companyNarrative)
    .where(and(
      eq(companyNarrative.companyId, companyId),
      eq(companyNarrative.periodStart, periodStart.toISOString().slice(0, 10)),
    ))
    .limit(1);

  if (existing.length > 0) return null;

  // ── Gather period data ────────────────────────────────────────────────────

  const [missionStats, goalStats, outcomeStats, costStats] = await Promise.all([
    getMissionStats(db, companyId, periodStart, periodEnd),
    getGoalStats(db, companyId, periodStart, periodEnd),
    getOutcomeStats(db, companyId, periodStart, periodEnd),
    getCostStats(db, companyId, periodStart, periodEnd),
  ]);

  // ── Determine momentum ────────────────────────────────────────────────────

  const momentum = computeMomentum(missionStats, outcomeStats);

  // ── Build narrative markdown ──────────────────────────────────────────────

  const narrativeMd = buildNarrativeMd({
    periodStart,
    periodEnd,
    missionStats,
    goalStats,
    outcomeStats,
    costStats,
    momentum,
  });

  // ── Key events ────────────────────────────────────────────────────────────

  const keyEvents = buildKeyEvents({ missionStats, goalStats, outcomeStats });

  // ── Focus areas ───────────────────────────────────────────────────────────

  const focusAreas = deriveFocusAreas(missionStats);

  // ── Persist ───────────────────────────────────────────────────────────────

  await (db as any).insert(companyNarrative).values({
    companyId,
    periodStart,
    periodEnd,
    narrativeMd,
    keyEvents:  JSON.stringify(keyEvents),
    momentum,
    focusAreas,
  });

  logger.info(
    { companyId, periodStart, momentum, missions: missionStats.total },
    "narrative: generated",
  );

  return { companyId, periodStart, periodEnd, momentum };
}

// ── getLatestNarrative ────────────────────────────────────────────────────────

/**
 * Returns the most recent narrative for injection into orchestrator preamble.
 * Called at context assembly time for orchestrator tasks.
 */
export async function getLatestNarrative(db: Db, companyId: string): Promise<string | null> {
  const rows = await (db as any)
    .select({ narrativeMd: companyNarrative.narrativeMd })
    .from(companyNarrative)
    .where(eq(companyNarrative.companyId, companyId))
    .orderBy(desc(companyNarrative.periodStart))
    .limit(1);

  return rows[0]?.narrativeMd ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface MissionStats {
  total:     number;
  completed: number;
  active:    number;
  titles:    string[];
}

interface GoalStats {
  total:      number;
  onTrack:    number;
  atRisk:     number;
}

interface OutcomeStats {
  positive: number;
  negative: number;
  neutral:  number;
}

interface CostStats {
  totalEur: number;
}

async function getMissionStats(db: Db, companyId: string, from: Date, to: Date): Promise<MissionStats> {
  const rows = await (db as any)
    .select({ status: missions.status, title: missions.title })
    .from(missions)
    .where(and(
      eq(missions.companyId, companyId),
      gte(missions.createdAt, from),
      lte(missions.createdAt, to),
    ));

  return {
    total:     rows.length,
    completed: rows.filter((r: any) => r.status === "complete").length,
    active:    rows.filter((r: any) => r.status === "active").length,
    titles:    rows.slice(0, 5).map((r: any) => r.title as string),
  };
}

async function getGoalStats(db: Db, companyId: string, from: Date, to: Date): Promise<GoalStats> {
  const rows = await (db as any)
    .select({ status: (goals as any).status })
    .from(goals)
    .where(and(
      eq((goals as any).companyId, companyId),
      gte((goals as any).updatedAt, from),
    ));

  return {
    total:   rows.length,
    onTrack: rows.filter((r: any) => r.status === "on_track").length,
    atRisk:  rows.filter((r: any) => r.status === "at_risk").length,
  };
}

async function getOutcomeStats(db: Db, companyId: string, from: Date, to: Date): Promise<OutcomeStats> {
  const rows = await (db as any)
    .select({
      outcomeValue: outcomeAttributions.outcomeValue,
      cnt: sql`count(distinct mission_id)`,
    })
    .from(outcomeAttributions)
    .where(and(
      eq(outcomeAttributions.companyId, companyId),
      gte(outcomeAttributions.createdAt, from),
      lte(outcomeAttributions.createdAt, to),
    ))
    .groupBy(outcomeAttributions.outcomeValue);

  const map: Record<string, number> = {};
  for (const r of rows) map[r.outcomeValue] = Number(r.cnt);
  return { positive: map.positive ?? 0, negative: map.negative ?? 0, neutral: map.neutral ?? 0 };
}

async function getCostStats(db: Db, companyId: string, from: Date, to: Date): Promise<CostStats> {
  const [row] = await (db as any)
    .select({ totalMicro: sql<number>`coalesce(sum(cost_eur_micro), 0)` })
    .from(costRecords)
    .where(and(
      eq(costRecords.companyId, companyId),
      gte(costRecords.createdAt, from),
      lte(costRecords.createdAt, to),
    ));

  return { totalEur: (Number(row?.totalMicro ?? 0)) / 1_000_000 };
}

function computeMomentum(m: MissionStats, o: OutcomeStats): Momentum {
  if (m.total === 0) return "stable";
  const completionRate = m.total > 0 ? m.completed / m.total : 0;
  const positiveRate   = (o.positive + o.negative) > 0
    ? o.positive / (o.positive + o.negative)
    : 0.5;

  if (completionRate > 0.7 && positiveRate > 0.7) return "accelerating";
  if (completionRate < 0.3 || positiveRate < 0.4)  return "decelerating";
  return "stable";
}

function buildNarrativeMd(opts: {
  periodStart:  Date;
  periodEnd:    Date;
  missionStats: MissionStats;
  goalStats:    GoalStats;
  outcomeStats: OutcomeStats;
  costStats:    CostStats;
  momentum:     Momentum;
}): string {
  const { periodStart, periodEnd, missionStats, goalStats, outcomeStats, costStats, momentum } = opts;
  const month = periodStart.toLocaleString("fr-FR", { month: "long", year: "numeric" });

  const momentumLabel = { accelerating: "en accélération", stable: "stable", decelerating: "en ralentissement" }[momentum];

  const lines = [
    `## Bilan — ${month}`,
    ``,
    `**Dynamique :** ${momentumLabel}`,
    ``,
    `### Missions`,
    `${missionStats.total} missions lancées — ${missionStats.completed} terminées, ${missionStats.active} en cours.`,
    missionStats.titles.length > 0 ? `Principales : ${missionStats.titles.slice(0, 3).join(", ")}.` : "",
    ``,
    `### Résultats`,
    `${outcomeStats.positive} missions à résultat positif, ${outcomeStats.negative} à résultat négatif.`,
    ``,
    `### Objectifs`,
    goalStats.total > 0
      ? `${goalStats.onTrack}/${goalStats.total} objectifs en bonne voie.${goalStats.atRisk > 0 ? ` ${goalStats.atRisk} à surveiller.` : ""}`
      : "Aucun objectif suivi ce mois.",
    ``,
    `### Coût IA`,
    `Dépense de traitement : ${costStats.totalEur.toFixed(2)} €`,
  ].filter((l) => l !== undefined);

  return lines.join("\n");
}

function buildKeyEvents(opts: {
  missionStats: MissionStats;
  goalStats:    GoalStats;
  outcomeStats: OutcomeStats;
}): Array<{ type: string; description: string }> {
  const events = [];
  if (opts.missionStats.completed > 0) {
    events.push({ type: "mission_completed", description: `${opts.missionStats.completed} missions terminées` });
  }
  if (opts.outcomeStats.positive > 0) {
    events.push({ type: "positive_outcome", description: `${opts.outcomeStats.positive} missions à résultat positif` });
  }
  if (opts.goalStats.atRisk > 0) {
    events.push({ type: "goal_at_risk", description: `${opts.goalStats.atRisk} objectif(s) à surveiller` });
  }
  return events;
}

function deriveFocusAreas(m: MissionStats): string[] {
  // Use mission titles to infer focus areas
  const areas = new Set<string>();
  for (const title of m.titles) {
    const lower = title.toLowerCase();
    if (lower.includes("client") || lower.includes("prospect")) areas.add("relation_client");
    if (lower.includes("recrutement") || lower.includes("cv"))    areas.add("recrutement");
    if (lower.includes("rapport") || lower.includes("analyse"))   areas.add("analyse");
    if (lower.includes("email") || lower.includes("message"))     areas.add("communication");
  }
  return Array.from(areas).slice(0, 3);
}
