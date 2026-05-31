/**
 * server/src/safety/constitution.ts
 *
 * C9 — Constitutional self-critique.
 *
 * The agent evaluates its own output against the [[CONSTITUTION]] block
 * in its soul.md BEFORE the output reaches the judge (C8).
 *
 * Uses the same model tier as the generation call — cheap, fast, same GDPR tier.
 * If constitution_passed = false → revised_output is used instead of original.
 * Revision is logged to task_execution_events (type: 'constitution_revision').
 *
 * INVARIANT: constitution check runs even if soul.md has no [[CONSTITUTION]]
 * block — uses the base constitution defined here as fallback.
 */

import pino from "pino";
import { callLLM } from "../llm/openrouter.js";

const logger = pino({ name: "constitution" });

// ── Base constitution (injected if soul.md has no [[CONSTITUTION]] block) ─────

export const BASE_CONSTITUTION = `[[CONSTITUTION]]
Avant de soumettre toute sortie, vérifie:
1. Uniquement les informations pertinentes à la tâche?
2. Chaque affirmation factuelle soutenue par le contexte?
3. Dans mon périmètre de responsabilité?
4. L'opérateur serait-il à l'aise si cette sortie était envoyée telle quelle?
Si une réponse est NON, révise avant soumission.`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConstitutionCheck {
  constitutionPassed: boolean;
  concern:            string | null;
  revisedOutput:      string | null;
}

// ── Extract constitution from soul.md ─────────────────────────────────────────

export function extractConstitution(soulMd: string | null | undefined): string {
  if (!soulMd) return BASE_CONSTITUTION;

  const match = soulMd.match(/\[\[CONSTITUTION\]\]([\s\S]*?)(?:\[\[|$)/);
  if (match?.[1]?.trim()) {
    return `[[CONSTITUTION]]\n${match[1].trim()}`;
  }

  return BASE_CONSTITUTION;
}

// ── Main check ────────────────────────────────────────────────────────────────

export async function runConstitutionCheck(
  params: {
    companyId:   string;
    taskId:      string;
    agentId:     string;
    soulMd:      string | null | undefined;
    taskBrief:   string;
    output:      string;
    model:       string;    // same model tier as generation
    gdprRequired: boolean;
  },
): Promise<ConstitutionCheck> {
  const { companyId, taskId, agentId, taskBrief, output, model, gdprRequired } = params;
  const constitution = extractConstitution(params.soulMd);

  const prompt = `${constitution}

TÂCHE:
${taskBrief}

MA SORTIE:
${output}

Applique chaque point de ta constitution à ta sortie. Réponds UNIQUEMENT en JSON:
{
  "constitution_passed": true/false,
  "concern": null | "<point de constitution non satisfait, une phrase>",
  "revised_output": null | "<sortie révisée si concern non null>"
}`;

  let raw: string;
  try {
    const response = await callLLM({
      model,
      companyId,
      agentId,
      taskId,
      gdprRequired,
      maxOutputTokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    raw = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    logger.warn({ taskId, err }, "constitution: LLM call failed — passing through");
    return { constitutionPassed: true, concern: null, revisedOutput: null };
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? "{}") as {
      constitution_passed?: boolean;
      concern?:             string | null;
      revised_output?:      string | null;
    };

    const result: ConstitutionCheck = {
      constitutionPassed: parsed.constitution_passed !== false,
      concern:            parsed.concern ?? null,
      revisedOutput:      parsed.revised_output ?? null,
    };

    if (!result.constitutionPassed) {
      logger.info({ taskId, concern: result.concern }, "constitution: agent revised output");
    }

    return result;
  } catch {
    logger.warn({ taskId }, "constitution: failed to parse response — passing through");
    return { constitutionPassed: true, concern: null, revisedOutput: null };
  }
}
