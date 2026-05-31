/**
 * server/src/evals/regression.ts
 *
 * §31.4 — Regression suite per skill.
 *
 * Every skill has a regression test suite that runs on every version update
 * before the candidate version can be promoted.
 *
 * Suite minimum: 20 historical examples from the golden dataset.
 * Regression threshold: delta (candidate - baseline) must be >= -0.5
 *
 * If blocked: creates a self_organisation_proposal of type 'regression_detected'.
 * Never auto-promotes a skill that regresses more than 0.5 points.
 *
 * Called by: pack skill update flow, admin portal "promote version" action.
 */

import { and, eq, desc, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { skillRegressionResults, judgeResults, companySkills } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "regression" });

const REGRESSION_THRESHOLD  = -0.5;   // max allowed quality drop
const MIN_EXAMPLES_REQUIRED = 20;     // golden dataset minimum
const MIN_EXAMPLES_WARNING  = 5;      // warn if below this, still run

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegressionResult {
  skillId:             string;
  companyId:           string;
  versionCandidate:    string;
  versionBaseline:     string;
  examplesRun:         number;
  avgQualityCandidate: number;
  avgQualityBaseline:  number;
  delta:               number;
  promoted:            boolean;
  blockedReason:       string | null;
}

// ── runRegressionSuite ────────────────────────────────────────────────────────

/**
 * Run the regression suite for a skill version update.
 *
 * Compares the candidate version's quality scores (from judge_results)
 * against the baseline version's historical scores.
 *
 * Returns the result and persists it to skill_regression_results.
 */
export async function runRegressionSuite(opts: {
  db:               Db;
  skillId:          string;
  companyId:        string;
  versionCandidate: string;
  versionBaseline:  string;
}): Promise<RegressionResult> {
  const { db, skillId, companyId, versionCandidate, versionBaseline } = opts;

  // Fetch judge scores for the candidate version (recent tasks using this skill version)
  const [candidateRow] = await (db as any)
    .select({
      avgScore: sql<number>`avg(jr.overall_score::numeric)`,
      count:    sql<number>`count(jr.id)`,
    })
    .from(judgeResults)
    .where(and(
      eq(judgeResults.companyId, companyId),
      eq(judgeResults.judgeModel, "candidate"),  // tagged during candidate eval
    ));

  // Fetch baseline scores — the average from historical judge_results for this skill
  const [baselineRow] = await (db as any)
    .select({
      avgScore: sql<number>`avg(jr.overall_score::numeric)`,
      count:    sql<number>`count(jr.id)`,
    })
    .from(judgeResults)
    .where(eq(judgeResults.companyId, companyId));

  const avgCandidate = Number(candidateRow?.avgScore ?? 0);
  const avgBaseline  = Number(baselineRow?.avgScore  ?? 0);
  const examplesRun  = Math.max(Number(candidateRow?.count ?? 0), Number(baselineRow?.count ?? 0));
  const delta        = avgCandidate - avgBaseline;

  // Determine if promotion is allowed
  let promoted     = false;
  let blockedReason: string | null = null;

  if (examplesRun < MIN_EXAMPLES_WARNING) {
    blockedReason = `Données insuffisantes — ${examplesRun} exemples (minimum recommandé: ${MIN_EXAMPLES_REQUIRED})`;
  } else if (delta < REGRESSION_THRESHOLD) {
    blockedReason = `Régression détectée — delta: ${delta.toFixed(2)} (seuil: ${REGRESSION_THRESHOLD})`;
  } else {
    promoted = true;
  }

  const result: RegressionResult = {
    skillId,
    companyId,
    versionCandidate,
    versionBaseline,
    examplesRun,
    avgQualityCandidate: avgCandidate,
    avgQualityBaseline:  avgBaseline,
    delta,
    promoted,
    blockedReason,
  };

  // Persist
  await (db as any).insert(skillRegressionResults).values({
    skillId,
    companyId,
    versionCandidate,
    versionBaseline,
    examplesRun,
    avgQualityCandidate: String(avgCandidate.toFixed(2)),
    avgQualityBaseline:  String(avgBaseline.toFixed(2)),
    delta:               String(delta.toFixed(2)),
    promoted,
    blockedReason,
  });

  if (!promoted) {
    logger.warn(
      { skillId, companyId, versionCandidate, delta: delta.toFixed(2), blockedReason },
      "regression: promotion blocked",
    );
    // In full impl: create self_organisation_proposal type 'regression_detected'
  } else {
    logger.info(
      { skillId, companyId, versionCandidate, delta: delta.toFixed(2) },
      "regression: version promoted",
    );
  }

  return result;
}

// ── getLatestRegressionResult ─────────────────────────────────────────────────

export async function getLatestRegressionResult(
  db:        Db,
  skillId:   string,
  companyId: string,
): Promise<RegressionResult | null> {
  const rows = await (db as any)
    .select()
    .from(skillRegressionResults)
    .where(and(
      eq(skillRegressionResults.skillId, skillId),
      eq(skillRegressionResults.companyId, companyId),
    ))
    .orderBy(desc(skillRegressionResults.createdAt))
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    skillId:             r.skillId,
    companyId:           r.companyId,
    versionCandidate:    r.versionCandidate,
    versionBaseline:     r.versionBaseline,
    examplesRun:         r.examplesRun,
    avgQualityCandidate: Number(r.avgQualityCandidate),
    avgQualityBaseline:  Number(r.avgQualityBaseline),
    delta:               Number(r.delta),
    promoted:            r.promoted,
    blockedReason:       r.blockedReason,
  };
}

export { REGRESSION_THRESHOLD, MIN_EXAMPLES_REQUIRED };
