/**
 * server/src/safety/confidence.ts
 *
 * AG-4 — Multi-factor confidence scoring.
 *
 * Runs alongside the judge (C8) — same T1_FR Mistral call.
 * Output feeds two effects:
 *   1. Approval queue priority (low confidence → top of 'Votre attention')
 *   2. Autonomy gate override (< 0.50 → force approval even if skill is 'autonomous')
 *
 * NEVER show raw score to operator — always plain-language flag only.
 */

import pino from "pino";
import { callLLM } from "../llm/openrouter.js";

const logger = pino({ name: "confidence" });

const CONFIDENCE_MODEL = "mistralai/mistral-small-3.2"; // T1_FR — always EU

export type ConfidenceFlag = "high" | "medium" | "low";

export interface ConfidenceScore {
  taskId:           string;
  reasoningQuality: number;   // 0-1
  evidenceStrength: number;   // 0-1
  outputConsistency: number;  // 0-1
  inputFamiliarity:  number;  // 0-1
  overall:          number;   // weighted 0.30/0.30/0.20/0.20
  flag:             ConfidenceFlag;
}

const WEIGHTS = { reasoning: 0.30, evidence: 0.30, consistency: 0.20, familiarity: 0.20 };

function toFlag(overall: number): ConfidenceFlag {
  if (overall >= 0.70) return "high";
  if (overall >= 0.50) return "medium";
  return "low";
}

function buildPrompt(taskBrief: string, output: string): string {
  return `Évalue la confiance de cette sortie d'agent IA sur 4 dimensions (0.0 à 1.0 chacune):

TÂCHE: ${taskBrief}
SORTIE: ${output}

Dimensions:
1. QUALITÉ DU RAISONNEMENT: Le raisonnement est-il cohérent et bien structuré?
2. FORCE DES PREUVES: Les affirmations sont-elles bien soutenues par le contexte?
3. COHÉRENCE DE LA SORTIE: La sortie est-elle consistante avec des sorties similaires passées?
4. FAMILIARITÉ DE L'ENTRÉE: La tâche ressemble-t-elle à des exemples déjà vus?

Réponds uniquement en JSON valide:
{
  "reasoning_quality": <0.0-1.0>,
  "evidence_strength": <0.0-1.0>,
  "output_consistency": <0.0-1.0>,
  "input_familiarity": <0.0-1.0>
}`;
}

export async function runConfidenceScoring(
  params: {
    companyId:  string;
    taskId:     string;
    agentId:    string;
    taskBrief:  string;
    output:     string;
  },
): Promise<ConfidenceScore> {
  const { companyId, taskId, agentId, taskBrief, output } = params;

  let raw: string;
  try {
    const response = await callLLM({
      model:           CONFIDENCE_MODEL,
      companyId,
      agentId,
      taskId,
      gdprRequired:    true,
      maxOutputTokens: 200,
      messages: [{ role: "user", content: buildPrompt(taskBrief, output) }],
    });
    raw = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    logger.warn({ taskId, err }, "confidence: LLM call failed — returning medium");
    return fallback(taskId);
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? "{}") as Record<string, number>;

    const rq = clamp(parsed.reasoning_quality  ?? 0.5);
    const es = clamp(parsed.evidence_strength  ?? 0.5);
    const oc = clamp(parsed.output_consistency ?? 0.5);
    const if_ = clamp(parsed.input_familiarity ?? 0.5);

    const overall = rq * WEIGHTS.reasoning + es * WEIGHTS.evidence +
                    oc * WEIGHTS.consistency + if_ * WEIGHTS.familiarity;

    const score: ConfidenceScore = {
      taskId,
      reasoningQuality:  rq,
      evidenceStrength:  es,
      outputConsistency: oc,
      inputFamiliarity:  if_,
      overall:           Math.round(overall * 100) / 100,
      flag:              toFlag(overall),
    };

    logger.info({ taskId, overall: score.overall, flag: score.flag }, "confidence: scored");
    return score;
  } catch {
    logger.warn({ taskId }, "confidence: parse failed — returning medium");
    return fallback(taskId);
  }
}

function clamp(v: number): number { return Math.min(1, Math.max(0, v)); }

function fallback(taskId: string): ConfidenceScore {
  return {
    taskId,
    reasoningQuality:  0.6,
    evidenceStrength:  0.6,
    outputConsistency: 0.6,
    inputFamiliarity:  0.6,
    overall:           0.6,
    flag:              "medium",
  };
}

/**
 * Returns true if overall confidence is below the autonomy override threshold.
 * Use this to force approval even if the skill is at 'autonomous' trust tier.
 */
export function shouldForceApproval(score: ConfidenceScore): boolean {
  return score.overall < 0.50;
}
