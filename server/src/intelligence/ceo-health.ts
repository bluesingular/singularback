/**
 * server/src/intelligence/ceo-health.ts
 *
 * §11.7 — CEO Health Score.
 *
 * CEO ratio = (time-equivalent of delegated operational tasks)
 *           ÷ (total estimated working time)
 *
 * Uses issues.skillType (already on the schema) to classify tasks.
 * Time-equivalent per tier: T0=5min, T1=15min, T2=30min, T3=60min
 * (stored in issues.metadata->>'tier' if available, defaults to T1).
 */

import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issues, embeddingMetrics } from "@paperclipai/db";
import type { CandidateCard } from "./sweep.js";
import pino from "pino";

const logger = pino({ name: "ceo-health" });

export interface CeoHealthScore {
  companyId:         string;
  periodLabel:       string;
  delegatedHours:    number;
  totalWorkingHours: number;
  ceoRatio:          number;
  ceoRatioPct:       number;
  trend:             number;
  taskCount:         number;
  sparkline:         { month: string; ratio: number }[];
  shareableCard:     string;
  computedAt:        Date;
}

const OPERATIONAL_SKILL_TYPES = new Set([
  "send_email", "qualify_cv", "web_search", "create_document",
  "data_entry", "schedule_meeting", "invoice_followup", "market_research",
]);

const TIER_MINUTES: Record<string, number> = { "0": 5, "1": 15, "2": 30, "3": 60 };

export async function computeCeoHealthScore(
  db:        Db,
  companyId: string,
  monthsBack: number = 0,
): Promise<CeoHealthScore> {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() - monthsBack;

  const periodStart = new Date(year, month, 1);
  const periodEnd   = new Date(year, month + 1, 0, 23, 59, 59);
  const periodLabel = periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const workingDays = countWorkingDays(periodStart, periodEnd);
  const totalWorkingHours = workingDays * 8;

  const completedTasks = await db.query.issues.findMany({
    where: and(
      eq(issues.companyId, companyId),
      eq(issues.status, "done"),
      gte(issues.completedAt, periodStart),
      sql`${issues.completedAt} <= ${periodEnd}`,
    ),
    columns: { skillType: true },
    limit: 2000,
  });

  let delegatedMinutes = 0;
  for (const task of completedTasks) {
    const skillType = task.skillType ?? "";
    if (!OPERATIONAL_SKILL_TYPES.has(skillType)) continue;
    delegatedMinutes += TIER_MINUTES["1"];  // default T1 = 15min
  }

  const delegatedHours = delegatedMinutes / 60;
  const ceoRatio       = totalWorkingHours > 0 ? Math.min(delegatedHours / totalWorkingHours, 1) : 0;

  let trend = 0;
  if (monthsBack === 0) {
    const prev = await computeCeoHealthScore(db, companyId, 1);
    trend = Math.round((ceoRatio - prev.ceoRatio) * 100);
  }

  const sparkline = await buildSparkline(db, companyId, ceoRatio, periodLabel);

  const ceoRatioPct = Math.round(ceoRatio * 100);
  const trendStr    = trend > 0 ? `En hausse de ${trend}%` : trend < 0 ? `En baisse de ${Math.abs(trend)}%` : "Stable";
  const shareableCard = `Votre ratio CEO ce mois : ${ceoRatioPct}%. ${trendStr} par rapport au mois précédent.`;

  logger.info({ companyId, ceoRatioPct, trend, taskCount: completedTasks.length }, "ceo-health: computed");

  return {
    companyId,
    periodLabel,
    delegatedHours:    Math.round(delegatedHours * 10) / 10,
    totalWorkingHours,
    ceoRatio,
    ceoRatioPct,
    trend,
    taskCount:         completedTasks.length,
    sparkline,
    shareableCard,
    computedAt:        new Date(),
  };
}

export async function ceoHealthCardGenerator(db: Db, companyId: string): Promise<CandidateCard[]> {
  const score = await computeCeoHealthScore(db, companyId);
  if (score.ceoRatioPct >= 40 && score.trend >= -5) return [];

  const cards: CandidateCard[] = [];

  if (score.ceoRatioPct < 20) {
    cards.push({ cardType: "goal", urgency: 2, title: `Ratio CEO ce mois : ${score.ceoRatioPct}%`, body: `Votre équipe gère ${score.ceoRatioPct}% de vos opérations courantes. ${score.delegatedHours}h déléguées sur ${score.totalWorkingHours}h estimées.`, insightKey: `ceo:health:${companyId}:${score.periodLabel}`, actionUrl: `/companies/${companyId}/ceo-health` });
  } else if (score.trend < -10) {
    cards.push({ cardType: "anomaly", urgency: 2, title: `Ratio CEO en baisse de ${Math.abs(score.trend)}%`, body: `Votre délégation a diminué ce mois (${score.ceoRatioPct}%).`, insightKey: `ceo:health:decline:${companyId}:${score.periodLabel}`, actionUrl: `/companies/${companyId}/ceo-health` });
  }

  return cards;
}

function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

async function buildSparkline(db: Db, companyId: string, currentRatio: number, currentLabel: string): Promise<{ month: string; ratio: number }[]> {
  const rows = await db.query.embeddingMetrics.findMany({
    where: eq(embeddingMetrics.companyId, companyId),
    orderBy: (t, { desc: d }) => [d(t.weekStart)],
    limit: 24,
    columns: { weekStart: true, autonomousTaskPct: true },
  });

  const byMonth = new Map<string, number[]>();
  for (const row of rows) {
    const label = new Date(row.weekStart).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    if (!byMonth.has(label)) byMonth.set(label, []);
    byMonth.get(label)!.push(Number(row.autonomousTaskPct ?? 0) / 100);
  }

  const sparkline = [...byMonth.entries()].slice(0, 5)
    .map(([month, ratios]) => ({ month, ratio: Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100) / 100 }))
    .reverse();

  sparkline.push({ month: currentLabel.slice(0, 8), ratio: Math.round(currentRatio * 100) / 100 });
  return sparkline;
}
