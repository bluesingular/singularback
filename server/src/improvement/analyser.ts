/**
 * server/src/improvement/analyser.ts
 *
 * Determines when and why to trigger skill self-improvement.
 *
 * Trigger conditions (either is sufficient):
 *   1. Trust score falls below 3.5 (M9 threshold for "supervised" floor)
 *   2. A damage-control event was recorded for this skill (M6)
 *
 * Once triggered, creates a draft skill_versions row.
 * The benchmark worker (M10) picks it up and runs golden-dataset evaluation.
 */

import { eq, and, desc } from "drizzle-orm";
import { skillVersions } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";

// Trust score below this threshold triggers improvement analysis
export const IMPROVEMENT_TRIGGER_SCORE = 3.5;

export type TriggerReason = "low_trust" | "damage_control" | "manual";

/**
 * Decide whether a new improvement cycle should start.
 *
 * @param trustScore    Current trust score for this agent+skill (0–5)
 * @param triggerReason Explicit reason supplied by the caller
 */
export function shouldTriggerImprovement(
  trustScore: number,
  triggerReason: TriggerReason | null,
): boolean {
  if (triggerReason === "damage_control" || triggerReason === "manual") {
    return true;
  }
  return trustScore < IMPROVEMENT_TRIGGER_SCORE;
}

// ── Draft version creation ────────────────────────────────────────────────────

export interface CreateDraftVersionParams {
  companyId:        string;
  skillType:        string;
  version:          string;       // e.g. "1.1.0"
  promptBody:       string;
  frontmatter:      Record<string, unknown>;
  parentVersionId?: string;
  createdByAgentId?: string;
  triggerReason:    TriggerReason;
}

/**
 * Persist a draft skill version for benchmarking.
 * Returns the new version's id.
 */
export async function createDraftVersion(
  db: Db,
  params: CreateDraftVersionParams,
): Promise<string> {
  const rows = await db
    .insert(skillVersions)
    .values({
      companyId:        params.companyId,
      skillType:        params.skillType,
      version:          params.version,
      promptBody:       params.promptBody,
      frontmatter:      params.frontmatter,
      parentVersionId:  params.parentVersionId ?? null,
      createdByAgentId: params.createdByAgentId ?? null,
      triggerReason:    params.triggerReason,
      status:           "draft",
    })
    .returning({ id: skillVersions.id });

  return rows[0].id;
}

/**
 * Fetch the currently active skill version for a given skill type.
 * Returns null if no active version exists yet.
 */
export async function getActiveVersion(
  db: Db,
  companyId: string,
  skillType: string,
): Promise<{ id: string; benchmarkScore: string | null } | null> {
  const [row] = await db
    .select({
      id:             skillVersions.id,
      benchmarkScore: skillVersions.benchmarkScore,
    })
    .from(skillVersions)
    .where(
      and(
        eq(skillVersions.companyId, companyId),
        eq(skillVersions.skillType, skillType),
        eq(skillVersions.status, "active"),
      ),
    )
    .orderBy(desc(skillVersions.activatedAt))
    .limit(1);

  return row ?? null;
}

/**
 * Bump the patch or minor version number.
 * "1.0.0" → "1.1.0";  "1.9.0" → "1.10.0"
 */
export function bumpMinorVersion(current: string): string {
  const [major, minor = 0] = current.split(".").map(Number);
  return `${major}.${(minor ?? 0) + 1}.0`;
}
