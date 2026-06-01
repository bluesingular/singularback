/**
 * server/src/missions/skill-composition.ts
 *
 * AG-15 — Dynamic skill composition at runtime.
 *
 * Operators can attach skill_overrides to a mission at creation or update time.
 * Overrides are mission-scoped — they never modify the agent's base configuration.
 *
 * Rules (from spec):
 *   - additional_skills: skill slugs to ADD for this mission only
 *   - removed_skills:    skill slugs to SUPPRESS for this mission only
 *   - Can only add skills already installed in the company's skill library
 *   - Preserves quality gate and golden dataset requirements
 *   - Logged to the mission record; audit trail shows active skills per task
 */

import { and, eq, inArray } from "drizzle-orm";
import { companySkills, missions } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "skill-composition" });

export interface MissionSkillOverride {
  agent_id:          string;
  additional_skills: string[];   // skill slugs to add for this mission only
  removed_skills:    string[];   // skill slugs to suppress for this mission only
}

/**
 * Validate and persist skill_overrides on a mission.
 * Throws if any additional_skill slug is not installed for the company.
 */
export async function setMissionSkillOverrides(
  db: Db,
  opts: {
    missionId:  string;
    companyId:  string;
    overrides:  MissionSkillOverride[];
  },
): Promise<void> {
  // Collect all slugs being added across all agents
  const additionalSlugs = [
    ...new Set(opts.overrides.flatMap((o) => o.additional_skills)),
  ];

  if (additionalSlugs.length > 0) {
    const installed = await db.query.companySkills.findMany({
      where: and(
        eq(companySkills.companyId, opts.companyId),
        inArray(companySkills.slug, additionalSlugs),
      ),
      columns: { slug: true },
    });

    const installedSlugs = new Set(installed.map((r) => r.slug));
    const missing = additionalSlugs.filter((s) => !installedSlugs.has(s));

    if (missing.length > 0) {
      throw new SkillNotInstalledError(opts.companyId, missing);
    }
  }

  await db
    .update(missions)
    .set({ skillOverrides: opts.overrides })
    .where(
      and(eq(missions.id, opts.missionId), eq(missions.companyId, opts.companyId)),
    );

  logger.info(
    { missionId: opts.missionId, overrideCount: opts.overrides.length },
    "ag-15: mission skill overrides saved",
  );
}

/**
 * Return the effective skill slug list for an agent within a mission.
 *
 * Starts from the agent's base installed skills, applies additional_skills,
 * then removes removed_skills. Result is deduplicated.
 */
export async function getEffectiveSkillsForAgent(
  db: Db,
  opts: {
    missionId: string;
    companyId: string;
    agentId:   string;
  },
): Promise<string[]> {
  const [mission, baseSkills] = await Promise.all([
    db.query.missions.findFirst({
      where: and(eq(missions.id, opts.missionId), eq(missions.companyId, opts.companyId)),
      columns: { skillOverrides: true },
    }),
    db.query.companySkills.findMany({
      where: eq(companySkills.companyId, opts.companyId),
      columns: { slug: true },
    }),
  ]);

  const base = new Set(baseSkills.map((s) => s.slug));

  const overrides = (mission?.skillOverrides ?? []) as MissionSkillOverride[];
  const agentOverride = overrides.find((o) => o.agent_id === opts.agentId);

  if (!agentOverride) return [...base];

  for (const slug of agentOverride.additional_skills) base.add(slug);
  for (const slug of agentOverride.removed_skills)    base.delete(slug);

  return [...base];
}

/**
 * Read the raw overrides stored on a mission (null if none set).
 */
export async function getMissionSkillOverrides(
  db: Db,
  missionId: string,
  companyId: string,
): Promise<MissionSkillOverride[] | null> {
  const row = await db.query.missions.findFirst({
    where: and(eq(missions.id, missionId), eq(missions.companyId, companyId)),
    columns: { skillOverrides: true },
  });
  if (!row || !row.skillOverrides) return null;
  return row.skillOverrides as MissionSkillOverride[];
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class SkillNotInstalledError extends Error {
  constructor(companyId: string, missingSlugs: string[]) {
    super(
      `Skills not installed for company ${companyId}: ${missingSlugs.join(", ")}`,
    );
    this.name = "SkillNotInstalledError";
  }
}
