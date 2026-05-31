/**
 * server/src/compliance/counterfactual-store.ts
 *
 * AG-14 — Counterfactual explainability: persistence layer.
 *
 * For high-risk tasks (cv_qualification, candidate_scoring, prospect_scoring),
 * a counterfactual explanation is generated after the judge evaluation and stored.
 *
 * Exposes:
 *   generateAndStore()  — called after judge for high-risk tasks
 *   getExplanation()    — task detail drill-down (one tap from approval card)
 *   formatForExport()   — AI Act WC-14 compliance export (external_safe only)
 */

import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { counterfactualExplanations } from "@paperclipai/db";
import {
  generateExplanation,
  formatForComplianceExport,
  type ExplainOpts,
} from "./counterfactual.js";
import pino from "pino";

const logger = pino({ name: "counterfactual-store" });

// ── High-risk skill slugs ─────────────────────────────────────────────────────

/** Skills for which counterfactual explanations are mandatory (AI Act high-risk). */
const HIGH_RISK_SKILL_SLUGS = new Set([
  "cv_qualification",
  "qualification-cv",
  "candidate_scoring",
  "prospect_scoring",
  "candidate-scoring",
  "prospect-scoring",
]);

export function isHighRiskSkill(skillSlug: string): boolean {
  return HIGH_RISK_SKILL_SLUGS.has(skillSlug);
}

// ── generateAndStore ──────────────────────────────────────────────────────────

export interface GenerateAndStoreOpts extends Omit<ExplainOpts, "outputId"> {
  db:        Db;
  taskId:    string;
  companyId: string;
  skillSlug: string;
  decision:  string;
}

/**
 * Generate a counterfactual explanation and persist it.
 * No-op if skill is not high-risk — caller should check isHighRiskSkill() first.
 */
export async function generateAndStore(opts: GenerateAndStoreOpts): Promise<string | null> {
  const { db, taskId, companyId, skillSlug, decision, ...explainOpts } = opts;

  if (!isHighRiskSkill(skillSlug)) return null;

  const explanation = generateExplanation({
    ...explainOpts,
    outputId: taskId,
  });

  // Build "Sans [X], la décision aurait été [Y]" counterfactuals from unmet criteria
  const counterfactuals = explainOpts.unmetCriteria.map((criterion) =>
    `Sans ${criterion}, la décision aurait pu être différente.`,
  );

  // key_factors: map criteria to FactorContribution shape
  const keyFactors = [
    ...explainOpts.metCriteria.map((c) => ({
      factor: c, direction: "positive" as const, importance: "significant" as const,
    })),
    ...explainOpts.unmetCriteria.map((c) => ({
      factor: c, direction: "negative" as const, importance: "decisive" as const,
    })),
  ];

  const [row] = await (db as any)
    .insert(counterfactualExplanations)
    .values({
      taskId,
      companyId,
      decision,
      keyFactors:     JSON.stringify(keyFactors),
      counterfactuals,
      externalSafe:   explanation.externalSafe,
      internalFull:   explanation.internalFull,
    })
    .returning({ id: counterfactualExplanations.id });

  logger.info(
    { taskId, companyId, skillSlug, externalSafeLines: explanation.externalSafe.length },
    "counterfactual-store: stored",
  );

  return row?.id ?? null;
}

// ── getExplanation ────────────────────────────────────────────────────────────

export interface StoredExplanation {
  id:             string;
  taskId:         string;
  decision:       string;
  keyFactors:     Array<{ factor: string; direction: "positive" | "negative"; importance: string }>;
  counterfactuals: string[];
  externalSafe:   string[];
  internalFull:   string[];
  generatedAt:    Date;
}

/**
 * Retrieve explanation for task detail drill-down.
 * Returns null if no explanation exists (non-high-risk task).
 */
export async function getExplanation(
  db:        Db,
  taskId:    string,
  companyId: string,
): Promise<StoredExplanation | null> {
  const rows = await (db as any)
    .select()
    .from(counterfactualExplanations)
    .where(eq(counterfactualExplanations.taskId, taskId))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];

  return {
    id:             row.id,
    taskId:         row.taskId,
    decision:       row.decision,
    keyFactors:     typeof row.keyFactors === "string"
      ? JSON.parse(row.keyFactors)
      : (row.keyFactors as any),
    counterfactuals: row.counterfactuals,
    externalSafe:   row.externalSafe,
    internalFull:   row.internalFull,
    generatedAt:    row.generatedAt,
  };
}

// ── formatForExport ───────────────────────────────────────────────────────────

/**
 * WC-14: Format stored explanation for AI Act compliance export.
 * external_safe lines only — validated GDPR-safe.
 */
export function formatStoredForExport(explanation: StoredExplanation) {
  return formatForComplianceExport({
    outputId:     explanation.taskId,
    externalSafe: explanation.externalSafe,
    internalFull: explanation.internalFull,
  });
}
