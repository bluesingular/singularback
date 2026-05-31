/**
 * server/src/analytics/embedding-depth.ts
 *
 * §31.5 — Operational embedding depth.
 *
 * Weekly computation of how deeply Swwarm is integrated into a company's
 * daily operations. Primary retention predictor and expansion signal.
 *
 * Score formula (0–100):
 *   taskVolume      = min(tasks/50, 1) × 25    → max 25 pts
 *   workflowBreadth = min(types/8,  1) × 25    → max 25 pts
 *   autonomyPct     = (autonomous%/100) × 25   → max 25 pts
 *   timeSaved       = min(hours/10, 1) × 25    → max 25 pts
 *
 * Surfaces:
 *   Admin portal  — score per customer + week-on-week trend
 *                   < 20 declining = at-risk (amber)
 *                   > 60 stable    = expansion candidate (green)
 *
 *   CEO Console   — plain language only, never the score:
 *                   "Votre équipe gère 34% de vos opérations courantes."
 *
 * Run weekly from morningIntelligence.worker (Monday sweep).
 */

import { and, eq, gte, sql, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { embeddingMetrics, issues, agents } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "embedding-depth" });

// ── Score formula ─────────────────────────────────────────────────────────────

export function computeEmbeddingScore(metrics: {
  taskCount:         number;
  workflowTypes:     number;
  autonomousTaskPct: number;
  timeSavedHours:    number;
}): number {
  const taskVolume      = Math.min(metrics.taskCount         / 50,  1) * 25;
  const workflowBreadth = Math.min(metrics.workflowTypes     / 8,   1) * 25;
  const autonomyPct     = (metrics.autonomousTaskPct / 100) * 25;
  const timeSaved       = Math.min(metrics.timeSavedHours    / 10,  1) * 25;
  return Math.min(100, Math.round(taskVolume + workflowBreadth + autonomyPct + timeSaved));
}

// ── computeAndStoreEmbeddingMetrics ───────────────────────────────────────────

/**
 * Compute embedding depth metrics for a company for the current week.
 * Upserts into embedding_metrics (idempotent — safe to call multiple times).
 */
export async function computeAndStoreEmbeddingMetrics(
  db:        Db,
  companyId: string,
  weekStart: Date,
): Promise<number> { // returns embedding_score
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Task stats for the week
  const [stats] = await (db as any)
    .select({
      totalTasks:    sql<number>`count(*)`,
      completedAuto: sql<number>`count(*) filter (where status = 'completed' and approved_by is null)`,
      completedAll:  sql<number>`count(*) filter (where status = 'completed')`,
    })
    .from(issues)
    .where(and(
      eq(issues.companyId, companyId),
      gte(issues.createdAt, weekStart),
      sql`created_at < ${weekEnd}`,
    ));

  const totalTasks     = Number(stats?.totalTasks    ?? 0);
  const completedAuto  = Number(stats?.completedAuto ?? 0);
  const completedAll   = Number(stats?.completedAll  ?? 0);
  const autonomousPct  = completedAll > 0 ? (completedAuto / completedAll) * 100 : 0;

  // Tasks by agent
  const agentRows = await (db as any)
    .select({
      agentId:  (issues as any).assigneeAgentId,
      cnt:      sql<number>`count(*)`,
    })
    .from(issues)
    .where(and(
      eq(issues.companyId, companyId),
      gte(issues.createdAt, weekStart),
      sql`created_at < ${weekEnd}`,
    ))
    .groupBy((issues as any).assigneeAgentId);

  const tasksByAgent: Record<string, number> = {};
  for (const row of agentRows) {
    if (row.agentId) tasksByAgent[row.agentId] = Number(row.cnt);
  }

  // Workflow type breadth (distinct task categories via title keywords — simplified)
  const workflowTypes = estimateWorkflowTypes(totalTasks, Object.keys(tasksByAgent).length);

  // Time saved estimate: 30 min per completed task on average
  const timeSavedHours = (completedAll * 0.5);

  const score = computeEmbeddingScore({
    taskCount:         totalTasks,
    workflowTypes,
    autonomousTaskPct: autonomousPct,
    timeSavedHours,
  });

  // Upsert
  await (db as any)
    .insert(embeddingMetrics)
    .values({
      companyId,
      weekStart:             weekStart.toISOString().slice(0, 10),
      tasksByAgent:          JSON.stringify(tasksByAgent),
      distinctWorkflowTypes: workflowTypes,
      humanTimeSavedHours:   String(timeSavedHours.toFixed(2)),
      autonomousTaskPct:     String(autonomousPct.toFixed(2)),
      embeddingScore:        String(score.toFixed(2)),
    })
    .onConflictDoUpdate({
      target: [(embeddingMetrics as any).companyId, (embeddingMetrics as any).weekStart],
      set: {
        tasksByAgent:          JSON.stringify(tasksByAgent),
        distinctWorkflowTypes: workflowTypes,
        humanTimeSavedHours:   String(timeSavedHours.toFixed(2)),
        autonomousTaskPct:     String(autonomousPct.toFixed(2)),
        embeddingScore:        String(score.toFixed(2)),
        computedAt:            new Date(),
      },
    });

  logger.info(
    { companyId, weekStart: weekStart.toISOString().slice(0, 10), score, totalTasks },
    "embedding-depth: computed",
  );

  return score;
}

// ── getLatestScore ────────────────────────────────────────────────────────────

export async function getLatestEmbeddingScore(
  db:        Db,
  companyId: string,
): Promise<{ score: number; weekStart: string } | null> {
  const rows = await (db as any)
    .select({ embeddingScore: embeddingMetrics.embeddingScore, weekStart: embeddingMetrics.weekStart })
    .from(embeddingMetrics)
    .where(eq(embeddingMetrics.companyId, companyId))
    .orderBy(desc(embeddingMetrics.weekStart))
    .limit(1);

  if (rows.length === 0) return null;
  return { score: Number(rows[0].embeddingScore), weekStart: rows[0].weekStart };
}

// ── formatForCeoConsole ───────────────────────────────────────────────────────

/**
 * §31.3 — Format embedding score for CEO Console.
 * NEVER show the raw score — always plain French.
 */
export function formatForCeoConsole(score: number): string {
  const pct = Math.round(score);
  if (pct < 20) {
    return "Votre équipe IA commence à prendre en charge vos opérations courantes.";
  }
  if (pct < 40) {
    return `Votre équipe gère ${pct}% de vos opérations courantes. Voici 2 domaines où elle pourrait faire plus.`;
  }
  if (pct < 70) {
    return `Votre équipe gère ${pct}% de vos opérations courantes. Voici des opportunités d'expansion.`;
  }
  return `Votre équipe gère ${pct}% de vos opérations courantes. L'automatisation est bien avancée.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function estimateWorkflowTypes(taskCount: number, agentCount: number): number {
  // Heuristic: more tasks and more agents = more workflow diversity
  return Math.min(Math.ceil(taskCount / 5) + agentCount, 20);
}
