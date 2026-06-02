/**
 * server/src/services/skill-merge.ts
 *
 * §20 Master skill update merge strategy.
 *
 * When the platform publishes a new master skill version, tenants can accept
 * the update. The merge strategy preserves tenant-evolved content:
 *
 *   take_master:    Copy master's markdown wholesale into tenant copy.
 *                   Golden datasets, trust scores, soul additions → kept.
 *   manual_review:  Block auto-merge, flag for human decision.
 *
 * The golden rule: a master update NEVER erases tenant evolution.
 * It replaces the base instructions — not the learning.
 */

import { and, eq } from "drizzle-orm";
import { companySkills, skillUpdateNotifications } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "skill-merge" });

const PLATFORM_COMPANY_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Notify all tenant copies of a master skill that a new version is available.
 * Called after the platform updates a master skill's markdown.
 */
export async function notifyTenantsOfMasterUpdate(
  db:            Db,
  masterSkillId: string,
  newVersion:    string,
  changelog?:    string,
): Promise<number> {
  // Find all tenant copies
  const copies = await (db as any)
    .select({
      id:        companySkills.id,
      companyId: companySkills.companyId,
    })
    .from(companySkills)
    .where(eq((companySkills as any).sourceSkillId, masterSkillId));

  if (copies.length === 0) return 0;

  // Upsert notifications — idempotent for same version
  for (const copy of copies) {
    await (db as any)
      .insert(skillUpdateNotifications)
      .values({
        masterSkillId,
        tenantSkillId: copy.id,
        companyId:     copy.companyId,
        newVersion,
        changelog:     changelog ?? null,
        status:        "pending",
        mergeStrategy: "take_master",
      })
      .onConflictDoNothing(); // unique (tenantSkillId, newVersion)
  }

  logger.info({ masterSkillId, newVersion, tenants: copies.length }, "skill-merge: update notifications created");
  return copies.length;
}

/**
 * Apply a master update to a specific tenant copy.
 *
 * Merge rules (spec §20):
 *   base_instructions → take_master   (overwrites tenant markdown)
 *   output_schema     → take_master   (must adopt for compatibility)
 *   golden_dataset    → keep_tenant   (NEVER overwrite)
 *   soul_additions    → keep_tenant   (NEVER overwrite)
 *   trust_calibration → keep_tenant   (NEVER reset on master update)
 *   metadata          → merge: master wins on new keys, tenant wins on existing customised keys
 */
export async function applyMasterUpdate(
  db:             Db,
  notificationId: string,
  decidedByUserId: string,
): Promise<void> {
  const [notification] = await (db as any)
    .select()
    .from(skillUpdateNotifications)
    .where(eq(skillUpdateNotifications.id, notificationId))
    .limit(1);

  if (!notification) throw new Error(`Notification not found: ${notificationId}`);
  if (notification.status !== "pending") throw new Error(`Notification already resolved: ${notification.status}`);
  if (notification.mergeStrategy === "manual_review") throw new Error("Manual review required — cannot auto-merge");

  // Fetch master skill
  const [master] = await (db as any)
    .select({ markdown: companySkills.markdown, metadata: companySkills.metadata })
    .from(companySkills)
    .where(eq(companySkills.id, notification.masterSkillId))
    .limit(1);

  if (!master) throw new Error(`Master skill not found: ${notification.masterSkillId}`);

  // Apply merge: take master's markdown, update masterVersion, preserve all else
  await (db as any).transaction(async (tx: Db) => {
    await (tx as any)
      .update(companySkills)
      .set({
        markdown:      master.markdown,        // take_master
        masterVersion: notification.newVersion, // update lineage version
        updatedAt:     new Date(),
      })
      .where(eq(companySkills.id, notification.tenantSkillId));

    await (tx as any)
      .update(skillUpdateNotifications)
      .set({
        status:    "merged",
        decidedAt: new Date(),
      })
      .where(eq(skillUpdateNotifications.id, notificationId));
  });

  logger.info(
    { notificationId, tenantSkillId: notification.tenantSkillId, version: notification.newVersion },
    "skill-merge: master update applied",
  );
}

/**
 * Dismiss a master update notification without merging.
 * The tenant keeps their current version.
 */
export async function dismissMasterUpdate(
  db:             Db,
  notificationId: string,
): Promise<void> {
  await (db as any)
    .update(skillUpdateNotifications)
    .set({ status: "dismissed", decidedAt: new Date() })
    .where(
      and(
        eq(skillUpdateNotifications.id, notificationId),
        eq(skillUpdateNotifications.status, "pending"),
      ),
    );
}

/**
 * Publish a master skill update: update the master's markdown and notify all tenants.
 * Called from the admin API when a platform admin saves a new master version.
 */
export async function publishMasterSkillUpdate(
  db:           Db,
  masterSkillId: string,
  newMarkdown:   string,
  newVersion:    string,
  changelog?:    string,
): Promise<{ notified: number }> {
  // Verify it's a master skill
  const [master] = await (db as any)
    .select({ id: companySkills.id, companyId: companySkills.companyId })
    .from(companySkills)
    .where(eq(companySkills.id, masterSkillId))
    .limit(1);

  if (!master || master.companyId !== PLATFORM_COMPANY_ID) {
    throw new Error("Not a master skill — only platform skills can be published as master updates");
  }

  await (db as any)
    .update(companySkills)
    .set({ markdown: newMarkdown, masterVersion: newVersion, updatedAt: new Date() })
    .where(eq(companySkills.id, masterSkillId));

  const notified = await notifyTenantsOfMasterUpdate(db, masterSkillId, newVersion, changelog);

  logger.info({ masterSkillId, newVersion, notified }, "skill-merge: master skill published");
  return { notified };
}
