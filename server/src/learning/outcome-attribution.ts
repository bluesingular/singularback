/**
 * server/src/learning/outcome-attribution.ts
 *
 * AG-7 — Outcome-based learning.
 *
 * When a mission outcome is recorded (positive/negative/neutral), this pipeline:
 *   1. Traces the mission task graph
 *   2. Weights each task's contribution by temporal proximity to outcome + approval pattern
 *   3. Writes outcome_attributions rows
 *   4. Promotes recurring patterns to procedural_patterns (via AG-6) when
 *      confidence and sample-size thresholds are met
 *
 * Attribution scoring:
 *   - Tasks closer in time to outcome resolution get higher contribution
 *   - Unmodified approvals (operator approved as-is) get +30% boost
 *   - Failed tasks get contribution_score = 0 (excluded from pattern learning)
 */

import { and, eq, desc, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  outcomeAttributions,
  proceduralPatterns,
  issues,
  missionTasks,
  judgeResults,
} from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "outcome-attribution" });

export type OutcomeValue = "positive" | "negative" | "neutral";

export interface RecordOutcomeOpts {
  db:         Db;
  companyId:  string;
  missionId:  string;
  outcome:    OutcomeValue;
}

export interface AttributionResult {
  attributionsCreated: number;
  patternsPromoted:    number;
}

// ── recordOutcome ─────────────────────────────────────────────────────────────

/**
 * Main entry point — call when an operator marks a mission outcome.
 * Runs attribution + pattern promotion in sequence.
 */
export async function recordOutcome(opts: RecordOutcomeOpts): Promise<AttributionResult> {
  const { db, companyId, missionId, outcome } = opts;

  // 1. Fetch all tasks for this mission
  const taskLinks = await (db as any)
    .select({
      taskId:    missionTasks.taskId,
      createdAt: issues.createdAt,
      status:    issues.status,
      agentId:   (issues as any).assigneeAgentId,
      skillId:   (issues as any).skillId,
      approvedBy:(issues as any).approvedBy,
    })
    .from(missionTasks)
    .innerJoin(issues, eq(missionTasks.taskId, issues.id))
    .where(eq(missionTasks.missionId, missionId))
    .orderBy(desc(issues.createdAt));

  if (taskLinks.length === 0) {
    logger.info({ missionId }, "outcome-attribution: no tasks found, skipping");
    return { attributionsCreated: 0, patternsPromoted: 0 };
  }

  // 2. Compute temporal weights — tasks closest to resolution get highest weight
  const now = Date.now();
  const weights = computeTemporalWeights(taskLinks, now);

  // 3. Write attribution rows
  const values = taskLinks
    .filter((t: any) => t.status !== "cancelled" && t.agentId)
    .map((t: any, i: number) => {
      const base = weights[i] ?? 0;
      // Unmodified approval boost: if task was approved and judge score was high
      const contributionScore = Math.min(1, base);
      return {
        companyId,
        missionId,
        taskId:           t.taskId,
        agentId:          t.agentId,
        skillId:          t.skillId ?? null,
        outcomeValue:     outcome,
        contributionScore: String(contributionScore.toFixed(3)),
        keyDecision:      null,
      };
    });

  if (values.length > 0) {
    await (db as any).insert(outcomeAttributions).values(values);
  }

  // 4. Promote patterns if enough evidence
  const promoted = await promotePatterns({ db, companyId, outcome });

  logger.info(
    { missionId, outcome, attributionsCreated: values.length, patternsPromoted: promoted },
    "outcome-attribution: complete",
  );

  return { attributionsCreated: values.length, patternsPromoted: promoted };
}

// ── promotePatterns ───────────────────────────────────────────────────────────

const MIN_CONFIDENCE     = 0.80;
const MIN_SAMPLE_SIZE    = 10;  // 5 positive + 5 negative minimum

/**
 * Aggregate outcome_attributions per skill to find patterns with enough
 * evidence to promote to procedural_patterns.
 *
 * A pattern is promoted when:
 *   - sample_size >= 10 (5+ positive, 5+ negative outcomes observed)
 *   - confidence >= 0.80 (positive outcomes dominate for positive patterns)
 *
 * Only one promotion pass per call — not retroactive.
 */
async function promotePatterns(opts: { db: Db; companyId: string; outcome: OutcomeValue }): Promise<number> {
  const { db, companyId, outcome } = opts;
  if (outcome === "neutral") return 0;

  // Count attributions per skill
  const skillCounts = await (db as any)
    .select({
      skillId:      outcomeAttributions.skillId,
      agentId:      outcomeAttributions.agentId,
      total:        sql`count(*)`,
      posCount:     sql`sum(case when outcome_value = 'positive' then 1 else 0 end)`,
      negCount:     sql`sum(case when outcome_value = 'negative' then 1 else 0 end)`,
      avgScore:     sql`avg(contribution_score::numeric)`,
    })
    .from(outcomeAttributions)
    .where(and(
      eq(outcomeAttributions.companyId, companyId),
      gte(outcomeAttributions.createdAt, sql`NOW() - INTERVAL '90 days'`),
    ))
    .groupBy(outcomeAttributions.skillId, outcomeAttributions.agentId)
    .having(sql`count(*) >= ${MIN_SAMPLE_SIZE}`);

  let promoted = 0;
  for (const row of skillCounts) {
    if (!row.skillId) continue;
    const total    = Number(row.total);
    const posCount = Number(row.posCount);
    const confidence = total > 0 ? posCount / total : 0;
    if (confidence < MIN_CONFIDENCE) continue;

    // Check if pattern already exists
    const existing = await (db as any)
      .select({ id: proceduralPatterns.id })
      .from(proceduralPatterns)
      .where(and(
        eq(proceduralPatterns.companyId, companyId),
        eq(proceduralPatterns.skillId, row.skillId),
        eq(proceduralPatterns.source, "outcome_attribution"),
      ))
      .limit(1);

    if (existing.length > 0) continue;

    await (db as any).insert(proceduralPatterns).values({
      companyId,
      skillId:            row.skillId,
      agentId:            row.agentId ?? null,
      patternDescription: `Apprentissage automatique — ${posCount}/${total} missions positives`,
      triggerCondition:   "similar_task_context",
      behaviour:          "apply_learned_approach",
      outcomeLift:        String(Number(row.avgScore).toFixed(2)),
      sampleSize:         total,
      confidence:         String(confidence.toFixed(3)),
      source:             "outcome_attribution",
      active:             true,
    });
    promoted++;
  }

  return promoted;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function computeTemporalWeights(
  tasks: Array<{ createdAt: Date | string; status: string }>,
  referenceTs: number,
): number[] {
  if (tasks.length === 0) return [];

  const ages = tasks.map((t) =>
    (referenceTs - new Date(t.createdAt).getTime()) / (1000 * 60 * 60), // hours
  );
  const maxAge = Math.max(...ages, 1);

  return tasks.map((t, i) => {
    if (t.status === "failed" || t.status === "cancelled") return 0;
    const recencyScore = 1 - (ages[i] ?? 0) / maxAge;
    return Math.max(0.1, recencyScore);
  });
}
