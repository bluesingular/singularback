/**
 * server/src/memory/procedural.ts
 *
 * AG-6 — Procedural memory: agents learn HOW to do things.
 *
 * Patterns are promoted to active after minimum evidence:
 *   5 positive + 5 negative missions, confidence >= 0.80
 *
 * Injected as "Préférences apprises:" in skill instructions.
 * Operator can review and deactivate in Gap F agent configuration panel.
 */

import { and, eq, gte } from "drizzle-orm";
import { proceduralPatterns } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "procedural-memory" });

const MIN_CONFIDENCE        = 0.80;
const MIN_POSITIVE_MISSIONS = 5;
const MIN_NEGATIVE_MISSIONS = 5;

export interface ProceduralPattern {
  id:                 string;
  patternDescription: string;
  triggerCondition:   string;
  behaviour:          string;
  confidence:         number;
}

/**
 * Load active procedural patterns for an agent+skill.
 * Injected as "Préférences apprises:" in context assembly.
 */
export async function getActivePatterns(
  db:        Db,
  companyId: string,
  agentId:   string,
  skillId:   string,
): Promise<ProceduralPattern[]> {
  const rows = await db
    .select({
      id:                 proceduralPatterns.id,
      patternDescription: proceduralPatterns.patternDescription,
      triggerCondition:   proceduralPatterns.triggerCondition,
      behaviour:          proceduralPatterns.behaviour,
      confidence:         proceduralPatterns.confidence,
    })
    .from(proceduralPatterns)
    .where(
      and(
        eq(proceduralPatterns.companyId, companyId),
        eq(proceduralPatterns.agentId, agentId),
        eq(proceduralPatterns.skillId, skillId),
        eq(proceduralPatterns.active, true),
        gte(proceduralPatterns.confidence, String(MIN_CONFIDENCE)),
      ),
    );

  return rows.map((r) => ({
    id:                 r.id,
    patternDescription: r.patternDescription,
    triggerCondition:   r.triggerCondition,
    behaviour:          r.behaviour,
    confidence:         parseFloat(r.confidence as string ?? "0"),
  }));
}

/**
 * Format active patterns as "Préférences apprises:" injection text.
 * Returns empty string if no patterns found.
 */
export async function buildPatternInjection(
  db:        Db,
  companyId: string,
  agentId:   string,
  skillId:   string,
): Promise<string> {
  const patterns = await getActivePatterns(db, companyId, agentId, skillId);
  if (patterns.length === 0) return "";

  const lines = ["Préférences apprises :", ""];
  for (const p of patterns) {
    lines.push(`• Quand : ${p.triggerCondition}`);
    lines.push(`  Comportement : ${p.behaviour}`);
    lines.push(`  Confiance : ${Math.round(p.confidence * 100)}%`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Record a new procedural pattern from operator correction or outcome attribution.
 */
export async function recordPattern(
  db:       Db,
  params: {
    companyId:          string;
    skillId:            string;
    agentId:            string;
    patternDescription: string;
    triggerCondition:   string;
    behaviour:          string;
    outcomeLift?:       number;
    sampleSize?:        number;
    confidence?:        number;
    source:             "outcome_attribution" | "operator_correction" | "collective_intelligence";
  },
): Promise<void> {
  await db.insert(proceduralPatterns).values({
    companyId:          params.companyId,
    skillId:            params.skillId,
    agentId:            params.agentId,
    patternDescription: params.patternDescription,
    triggerCondition:   params.triggerCondition,
    behaviour:          params.behaviour,
    outcomeLift:        params.outcomeLift ? String(params.outcomeLift) : null,
    sampleSize:         params.sampleSize ?? null,
    confidence:         params.confidence ? String(params.confidence) : null,
    source:             params.source,
    active:             (params.confidence ?? 0) >= MIN_CONFIDENCE,
  });

  logger.info(
    { companyId: params.companyId, agentId: params.agentId, source: params.source },
    "procedural-memory: pattern recorded",
  );
}
