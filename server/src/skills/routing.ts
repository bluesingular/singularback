/**
 * server/src/skills/routing.ts
 *
 * G2 — Skill capability lookup for LLM routing.
 *
 * Reads gdprRequired, tier, and aiActRisk from the company_skills table
 * (populated at pack install from SKILL.md frontmatter) and returns a minimal
 * ParsedSkill-compatible object for routeModel() and assertGdprSafe().
 *
 * Falls back to safe defaults (gdprRequired=false, tier=1) when the skill
 * is not found — never throws, never leaks.
 */

import { and, eq } from "drizzle-orm";
import { companySkills } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import type { ParsedSkill } from "./parser.js";
import pino from "pino";

const logger = pino({ name: "skill-routing" });

/** Minimal ParsedSkill shape needed by routeModel() */
export type SkillForRouting = Pick<ParsedSkill, "name" | "tier" | "gdprRequired">;

/**
 * Fetch the routing-relevant fields for a skill from the DB.
 * Returns safe defaults if the skill is not found.
 */
export async function getSkillForRouting(
  db:        Db,
  companyId: string,
  skillSlug: string,
): Promise<SkillForRouting> {
  const [skill] = await db
    .select({
      name:         companySkills.name,
      tier:         companySkills.tier,
      gdprRequired: companySkills.gdprRequired,
    })
    .from(companySkills)
    .where(
      and(
        eq(companySkills.companyId, companyId),
        eq(companySkills.slug, skillSlug),
      ),
    )
    .limit(1);

  if (!skill) {
    logger.warn({ companyId, skillSlug }, "skill-routing: skill not found — using safe defaults");
    return { name: skillSlug, tier: 1, gdprRequired: false };
  }

  return {
    name:         skill.name,
    tier:         (skill.tier ?? 1) as 0 | 1 | 2 | 3,
    gdprRequired: skill.gdprRequired ?? false,
  };
}
