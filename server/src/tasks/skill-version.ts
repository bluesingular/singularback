/**
 * G7 — Skill version pinning service.
 *
 * When a task is assigned to an agent, the current active skill version is pinned
 * to the task (skill_version_id). If the skill is later updated, in-progress tasks
 * continue to use their pinned version. Only new tasks pick up the new version.
 *
 * Key functions:
 *   getActiveSkillVersion  — returns the current active version for a skill type
 *   pinSkillVersion        — writes skill_version_id onto an existing task
 *   resolveSkillForTask    — returns the prompt + frontmatter to use for a task
 *                            (pinned version if present, else current active)
 *   activateSkillVersion   — marks a version as active, deprecates the previous one
 */

import { eq, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { skillVersions, issues } from "@paperclipai/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResolvedSkill {
  versionId:   string;
  version:     string;
  skillType:   string;
  promptBody:  string;
  frontmatter: Record<string, unknown>;
  pinned:      boolean; // true = using a pinned version, false = live active
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns the current active skill version for a given skill type and company.
 * Returns null if no active version exists yet.
 */
export async function getActiveSkillVersion(
  db: Db,
  companyId: string,
  skillType: string,
): Promise<ResolvedSkill | null> {
  const [row] = await (db as any)
    .select({
      id:          skillVersions.id,
      version:     skillVersions.version,
      skillType:   skillVersions.skillType,
      promptBody:  skillVersions.promptBody,
      frontmatter: skillVersions.frontmatter,
    })
    .from(skillVersions)
    .where(
      and(
        eq(skillVersions.companyId, companyId),
        eq(skillVersions.skillType, skillType),
        eq(skillVersions.status, "active"),
      ),
    )
    .orderBy(skillVersions.activatedAt)
    .limit(1);

  if (!row) return null;
  return {
    versionId:   row.id,
    version:     row.version,
    skillType:   row.skillType,
    promptBody:  row.promptBody,
    frontmatter: row.frontmatter as Record<string, unknown>,
    pinned:      false,
  };
}

/**
 * Pins the current active skill version to a task.
 * Called at task creation or when an agent is first assigned.
 * No-op if the task already has a pinned version or no active version exists.
 */
export async function pinSkillVersion(
  db: Db,
  taskId: string,
  companyId: string,
  skillType: string,
): Promise<string | null> {
  const active = await getActiveSkillVersion(db, companyId, skillType);
  if (!active) return null;

  await (db as any)
    .update(issues)
    .set({ skillType, skillVersionId: active.versionId })
    .where(
      and(
        eq(issues.id, taskId),
        eq(issues.companyId, companyId),
      ),
    );

  return active.versionId;
}

/**
 * Returns the skill to use when executing a task:
 *   1. If the task has a pinned skill_version_id → use that exact version
 *   2. Otherwise → fall back to the current active version for the skill type
 *
 * Returns null if neither is available (skill not yet set up).
 */
export async function resolveSkillForTask(
  db: Db,
  taskId: string,
  companyId: string,
): Promise<ResolvedSkill | null> {
  // Load the task's pinned version info
  const [task] = await (db as any)
    .select({ skillVersionId: issues.skillVersionId, skillType: issues.skillType })
    .from(issues)
    .where(and(eq(issues.id, taskId), eq(issues.companyId, companyId)));

  if (!task) return null;

  // Case 1: pinned version
  if (task.skillVersionId) {
    const [pinned] = await (db as any)
      .select({
        id:          skillVersions.id,
        version:     skillVersions.version,
        skillType:   skillVersions.skillType,
        promptBody:  skillVersions.promptBody,
        frontmatter: skillVersions.frontmatter,
      })
      .from(skillVersions)
      .where(eq(skillVersions.id, task.skillVersionId));

    if (pinned) {
      return {
        versionId:   pinned.id,
        version:     pinned.version,
        skillType:   pinned.skillType,
        promptBody:  pinned.promptBody,
        frontmatter: pinned.frontmatter as Record<string, unknown>,
        pinned:      true,
      };
    }
  }

  // Case 2: no pin → current active for the skill type
  if (task.skillType) {
    return getActiveSkillVersion(db, companyId, task.skillType);
  }

  return null;
}

/**
 * Activates a specific skill version.
 * Deprecates any previously active version for the same skill type.
 * Only applies to NEW tasks — existing pinned tasks are unaffected.
 */
export async function activateSkillVersion(
  db: Db,
  versionId: string,
  companyId: string,
): Promise<void> {
  // Load the target version to get the skill type
  const [target] = await (db as any)
    .select({ skillType: skillVersions.skillType, status: skillVersions.status })
    .from(skillVersions)
    .where(and(eq(skillVersions.id, versionId), eq(skillVersions.companyId, companyId)));

  if (!target) throw new Error(`Skill version ${versionId} not found`);
  if (target.status === "active") return; // already active, idempotent

  // Deprecate any currently active version for this skill type
  await (db as any)
    .update(skillVersions)
    .set({ status: "deprecated" })
    .where(
      and(
        eq(skillVersions.companyId, companyId),
        eq(skillVersions.skillType, target.skillType),
        eq(skillVersions.status, "active"),
      ),
    );

  // Activate the target version
  await (db as any)
    .update(skillVersions)
    .set({ status: "active", activatedAt: new Date() })
    .where(eq(skillVersions.id, versionId));
}
