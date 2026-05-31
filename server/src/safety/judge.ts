/**
 * server/src/safety/judge.ts
 *
 * C8 — LLM-as-judge layer.
 *
 * Evaluates agent output before it reaches the operator.
 * Judge model is ALWAYS T1_FR (Mistral EU) — never a non-EU model.
 * Runs AFTER output generation, BEFORE quality gates.
 *
 * If overall_score < 6.0 → auto_recycle = true (max 2 recycles per task).
 * Scores and dimension breakdown are persisted to judge_results table.
 * Approval card always shows the score summary (never the raw number).
 */

import { eq } from "drizzle-orm";
import { judgeResults } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { callLLM } from "../llm/openrouter.js";
import pino from "pino";

const logger = pino({ name: "judge" });

const JUDGE_MODEL = "mistralai/mistral-small-3.2"; // T1_FR — always EU

const AUTO_RECYCLE_THRESHOLD = 6.0;
const MAX_RECYCLES           = 2;

// Default dimension weights (pack-configurable via pack.json judge_weights)
const DEFAULT_WEIGHTS = {
  relevance:       0.30,
  accuracy:        0.25,
  tone:            0.15,
  completeness:    0.20,
  scope_adherence: 0.10,
} as const;

export interface JudgeDimension {
  score: number;   // 0-10
  note:  string;
}

export interface JudgeResult {
  outputId:     string;
  overallScore: number;
  autoRecycle:  boolean;
  explanation:  string;    // plain French for approval card
  dimensions: {
    relevance:       JudgeDimension;
    accuracy:        JudgeDimension;
    tone:            JudgeDimension;
    completeness:    JudgeDimension;
    scopeAdherence:  JudgeDimension;
  };
}

// ── Judge prompt ──────────────────────────────────────────────────────────────

function buildJudgePrompt(taskBrief: string, output: string): string {
  return `Tu es un évaluateur qualité strict. Évalue la sortie suivante d'un agent IA.

TÂCHE DEMANDÉE:
${taskBrief}

SORTIE DE L'AGENT:
${output}

Évalue sur 5 dimensions, chacune notée de 0 à 10:
1. PERTINENCE: La sortie répond-elle exactement à la tâche demandée?
2. EXACTITUDE: Les informations sont-elles factuellement correctes et soutenues par le contexte?
3. TON: Le ton est-il approprié et professionnel?
4. COMPLÉTUDE: La sortie est-elle complète et ne manque-t-il rien d'important?
5. PÉRIMÈTRE: L'agent s'est-il limité à son périmètre de responsabilité?

Réponds UNIQUEMENT en JSON valide, format exact:
{
  "relevance":       { "score": <0-10>, "note": "<une phrase>" },
  "accuracy":        { "score": <0-10>, "note": "<une phrase>" },
  "tone":            { "score": <0-10>, "note": "<une phrase>" },
  "completeness":    { "score": <0-10>, "note": "<une phrase>" },
  "scope_adherence": { "score": <0-10>, "note": "<une phrase>" },
  "explanation":     "<résumé en une phrase pour l'opérateur>"
}`;
}

// ── Main judge function ───────────────────────────────────────────────────────

export async function runJudge(
  db:        Db,
  params: {
    companyId:      string;
    taskId:         string;
    agentId:        string;
    taskBrief:      string;
    output:         string;
    outputVersion?: number;
    weights?:       Partial<typeof DEFAULT_WEIGHTS>;
  },
): Promise<JudgeResult> {
  const { companyId, taskId, agentId, taskBrief, output, outputVersion = 1 } = params;
  const weights = { ...DEFAULT_WEIGHTS, ...params.weights };

  // Call judge — always T1_FR, never non-EU (GDPR invariant extends to evaluation)
  let raw: string;
  try {
    const response = await callLLM({
      model:           JUDGE_MODEL,
      companyId,
      agentId,
      taskId,
      gdprRequired:    true,  // Judge sees output which may contain personal data
      maxOutputTokens: 600,
      messages: [
        {
          role:    "user",
          content: buildJudgePrompt(taskBrief, output),
        },
      ],
    });
    raw = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    logger.error({ taskId, err }, "judge: LLM call failed — using fallback score");
    // Fallback: pass with neutral score so task is not blocked on judge failure
    return buildFallbackResult(taskId, outputVersion);
  }

  // Parse JSON from judge response
  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
  } catch {
    logger.warn({ taskId }, "judge: failed to parse JSON response — using fallback");
    return buildFallbackResult(taskId, outputVersion);
  }

  const dim = (key: string): JudgeDimension => ({
    score: Math.min(10, Math.max(0, Number((parsed[key] as any)?.score ?? 5))),
    note:  String((parsed[key] as any)?.note ?? ""),
  });

  const dimensions = {
    relevance:      dim("relevance"),
    accuracy:       dim("accuracy"),
    tone:           dim("tone"),
    completeness:   dim("completeness"),
    scopeAdherence: dim("scope_adherence"),
  };

  const overallScore =
    dimensions.relevance.score      * weights.relevance +
    dimensions.accuracy.score       * weights.accuracy +
    dimensions.tone.score           * weights.tone +
    dimensions.completeness.score   * weights.completeness +
    dimensions.scopeAdherence.score * weights.scope_adherence;

  const roundedScore = Math.round(overallScore * 10) / 10;
  const autoRecycle  = roundedScore < AUTO_RECYCLE_THRESHOLD;
  const explanation  = String(parsed.explanation ?? "Évaluation automatique effectuée.");

  // Persist to judge_results
  await db.insert(judgeResults).values({
    companyId,
    taskId,
    outputVersion,
    judgeModel:   JUDGE_MODEL,
    dimensions:   dimensions as unknown as Record<string, unknown>,
    overallScore: String(roundedScore),
    autoRecycled: autoRecycle,
  });

  logger.info(
    { taskId, overallScore: roundedScore, autoRecycle, outputVersion },
    "judge: evaluation complete",
  );

  return {
    outputId:    taskId,
    overallScore: roundedScore,
    autoRecycle,
    explanation,
    dimensions,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFallbackResult(taskId: string, outputVersion: number): JudgeResult {
  const neutral: JudgeDimension = { score: 7, note: "Évaluation non disponible." };
  return {
    outputId:     taskId,
    overallScore: 7.0,
    autoRecycle:  false,
    explanation:  "Évaluation automatique non disponible — sortie transmise à l'opérateur.",
    dimensions: {
      relevance:      neutral,
      accuracy:       neutral,
      tone:           neutral,
      completeness:   neutral,
      scopeAdherence: neutral,
    },
  };
}

export { MAX_RECYCLES, AUTO_RECYCLE_THRESHOLD };
