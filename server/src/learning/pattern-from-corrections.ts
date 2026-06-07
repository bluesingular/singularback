/**
 * server/src/learning/pattern-from-corrections.ts
 *
 * AG-6 — Procedural pattern extraction from operator corrections (Gap B).
 *
 * After an operator makes inline edits (source: 'inline_approval_edit'), golden_datasets
 * entries accumulate. Once MIN_CORRECTIONS_REQUIRED corrections exist for the same
 * (companyId, skillType), this module uses Mistral EU (T1_FR, never non-EU) to:
 *   1. Analyse the diff between agentOutput and expectedOutput for each correction
 *   2. Extract a behavioural pattern describing WHAT the operator consistently changes
 *   3. Write a proceduralPatterns row with source='operator_correction'
 *
 * Called from task-inline-edit.ts after each successful correction recording.
 * Idempotent: skips extraction if a pattern from operator_correction already exists
 * for that (companyId, skillType) within the last 30 days.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { goldenDatasets, proceduralPatterns, companySkills } from "@paperclipai/db";
import { callLLM } from "../llm/openrouter.js";
import pino from "pino";

const logger = pino({ name: "pattern-from-corrections" });

const MIN_CORRECTIONS_REQUIRED = 3;
const PATTERN_ANALYSIS_MODEL   = "mistralai/mistral-small-3.2"; // T1_FR — always EU
const LOOKBACK_DAYS            = 30;

interface CorrectionExample {
  agentOutput:    string;
  operatorEdit:   string;
}

/**
 * Call after each Gap B inline edit is saved.
 * Extracts a procedural pattern once MIN_CORRECTIONS_REQUIRED examples exist.
 */
export async function maybeExtractCorrectionPattern(opts: {
  db:         Db;
  companyId:  string;
  skillType:  string;
}): Promise<{ extracted: boolean; patternId?: string }> {
  const { db, companyId, skillType } = opts;

  // 1. Count existing corrections for this skill
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  const corrections = await db
    .select({
      agentOutput:    goldenDatasets.agentOutput,
      expectedOutput: goldenDatasets.expectedOutput,
    })
    .from(goldenDatasets)
    .where(
      and(
        eq(goldenDatasets.companyId, companyId),
        eq(goldenDatasets.skillType, skillType),
        eq(goldenDatasets.source, "inline_approval_edit"),
        gte(goldenDatasets.createdAt, cutoff),
      ),
    )
    .limit(20);

  if (corrections.length < MIN_CORRECTIONS_REQUIRED) {
    logger.debug(
      { companyId, skillType, count: corrections.length, required: MIN_CORRECTIONS_REQUIRED },
      "pattern-from-corrections: not enough corrections yet",
    );
    return { extracted: false };
  }

  // 2. Check if we already extracted a pattern recently
  const existingPattern = await db
    .select({ id: proceduralPatterns.id })
    .from(proceduralPatterns)
    .where(
      and(
        eq(proceduralPatterns.companyId, companyId),
        eq(proceduralPatterns.source, "operator_correction"),
        gte(proceduralPatterns.createdAt, cutoff),
        // Match on skill type via agentId null check (skill-level pattern, not agent-specific)
        sql`lower(pattern_description) like ${"%" + skillType.toLowerCase() + "%"}`,
      ),
    )
    .limit(1);

  if (existingPattern.length > 0) {
    logger.debug({ companyId, skillType }, "pattern-from-corrections: pattern already extracted this month");
    return { extracted: false };
  }

  // 3. Build correction examples for LLM analysis
  const examples: CorrectionExample[] = corrections
    .filter((c) => c.agentOutput && c.expectedOutput)
    .map((c) => ({
      agentOutput:  c.agentOutput ?? "",
      operatorEdit: typeof c.expectedOutput === "object" && c.expectedOutput !== null
        ? ((c.expectedOutput as Record<string, unknown>).text as string ?? JSON.stringify(c.expectedOutput))
        : String(c.expectedOutput ?? ""),
    }))
    .filter((c) => c.agentOutput !== c.operatorEdit);

  if (examples.length < MIN_CORRECTIONS_REQUIRED) {
    return { extracted: false };
  }

  // 4. Ask Mistral EU to extract the behavioural pattern
  const examplesText = examples
    .slice(0, 10) // cap at 10 to stay within token budget
    .map((ex, i) =>
      `--- Exemple ${i + 1} ---\nSortie agent :\n${ex.agentOutput.slice(0, 400)}\n\nCorrection opérateur :\n${ex.operatorEdit.slice(0, 400)}`,
    )
    .join("\n\n");

  const systemPrompt = [
    "Tu es un analyste comportemental pour agents IA.",
    "Analyse les corrections apportées par l'opérateur à la sortie de l'agent.",
    "Identifie UN pattern comportemental récurrent — ce que l'opérateur change systématiquement.",
    "",
    "Réponds UNIQUEMENT avec un JSON valide :",
    "{",
    '  "triggerCondition": "description courte de quand ce pattern s\'applique (max 100 chars)",',
    '  "behaviour": "description de la correction systématique à appliquer (max 150 chars)",',
    '  "patternDescription": "phrase descriptive du pattern appris (max 200 chars)"',
    "}",
  ].join("\n");

  let patternJson: { triggerCondition: string; behaviour: string; patternDescription: string } | null = null;

  try {
    const response = await callLLM({
      model:           PATTERN_ANALYSIS_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: `Compétence analysée : ${skillType}\n\n${examplesText}` },
      ],
      maxOutputTokens: 400,
      companyId,
      agentId:         "system",
      taskId:          "pattern-extraction",
      gdprRequired:    true, // always T1_FR — corrections may contain company-specific content
      skillName:       "pattern-extractor",
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      patternJson = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    logger.warn({ err, companyId, skillType }, "pattern-from-corrections: LLM extraction failed");
    return { extracted: false };
  }

  if (!patternJson?.triggerCondition || !patternJson?.behaviour) {
    logger.warn({ companyId, skillType }, "pattern-from-corrections: LLM returned invalid pattern JSON");
    return { extracted: false };
  }

  // 5. Find the skill DB id for this company + skillType
  const [skill] = await db
    .select({ id: companySkills.id })
    .from(companySkills)
    .where(
      and(
        eq(companySkills.companyId, companyId),
        eq(companySkills.slug, skillType),
      ),
    )
    .limit(1);

  const confidence = Math.min(0.95, 0.70 + (examples.length - MIN_CORRECTIONS_REQUIRED) * 0.05);

  const [inserted] = await db
    .insert(proceduralPatterns)
    .values({
      companyId,
      skillId:            skill?.id ?? null,
      agentId:            null, // skill-level pattern, applies to all agents with this skill
      patternDescription: patternJson.patternDescription.slice(0, 200),
      triggerCondition:   patternJson.triggerCondition.slice(0, 100),
      behaviour:          patternJson.behaviour.slice(0, 150),
      outcomeLift:        null,
      sampleSize:         examples.length,
      confidence:         String(confidence.toFixed(3)),
      source:             "operator_correction",
      active:             confidence >= 0.80,
    })
    .returning({ id: proceduralPatterns.id });

  logger.info(
    { companyId, skillType, patternId: inserted?.id, confidence, sampleSize: examples.length },
    "pattern-from-corrections: operator correction pattern extracted and saved",
  );

  return { extracted: true, patternId: inserted?.id };
}
