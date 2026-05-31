/**
 * server/src/llm/model-pins.ts
 *
 * Gap D — Model upgrade resilience.
 *
 * Skills can be pinned to a specific model version when a regression is detected
 * or an operator requests a manual pin. The LLM router reads this pin and overrides
 * the default routing decision.
 *
 * Pin reasons:
 *   'upgrade_blocked_by_regression' — pre-upgrade regression suite failed (delta < -0.5)
 *   'manual_pin'                    — operator explicitly pinned from admin portal
 *
 * GDPR invariant: a model pin NEVER overrides GDPR routing.
 * If the pinned model is not GDPR-safe and the skill requires GDPR, the pin is
 * ignored and the router falls back to the GDPR-safe model.
 */

import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { skillModelPins } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "model-pins" });

// EU-hosted models that are safe for GDPR skills
const EU_MODELS = new Set([
  "mistralai/ministral-3b",
  "mistralai/mistral-small-3.2",
  "mistralai/mistral-medium-3.1",
  "mistralai/mistral-large-2411",
]);

export interface ModelPin {
  skillId:      string;
  companyId:    string;
  modelVersion: string;
  pinnedReason: "upgrade_blocked_by_regression" | "manual_pin";
}

// ── getModelPin ───────────────────────────────────────────────────────────────

/**
 * Return the pinned model version for a skill+company, or null if no pin.
 * Called by the LLM router before building the routing decision.
 */
export async function getModelPin(
  db:        Db,
  companyId: string,
  skillId:   string,
): Promise<string | null> {
  const rows = await (db as any)
    .select({
      modelVersion: skillModelPins.modelVersion,
      pinnedReason: skillModelPins.pinnedReason,
    })
    .from(skillModelPins)
    .where(and(
      eq(skillModelPins.companyId, companyId),
      eq(skillModelPins.skillId, skillId),
    ))
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0].modelVersion;
}

// ── applyModelPin ─────────────────────────────────────────────────────────────

/**
 * Apply a model pin to a routing decision, respecting GDPR.
 * Returns the pinned model if safe, or the original model if GDPR prevents it.
 */
export function applyModelPin(opts: {
  originalModel:  string;
  pinnedModel:    string;
  gdprRequired:   boolean;
}): string {
  const { originalModel, pinnedModel, gdprRequired } = opts;

  if (!gdprRequired) return pinnedModel;

  // GDPR invariant: pin can only be applied if pinned model is EU-hosted
  if (EU_MODELS.has(pinnedModel)) return pinnedModel;

  logger.warn(
    { pinnedModel, originalModel },
    "model-pins: pin ignored — pinned model is not EU-hosted and skill requires GDPR",
  );
  return originalModel;
}

// ── setModelPin ───────────────────────────────────────────────────────────────

export async function setModelPin(
  db:          Db,
  companyId:   string,
  skillId:     string,
  modelVersion: string,
  reason:      "upgrade_blocked_by_regression" | "manual_pin",
): Promise<void> {
  await (db as any)
    .insert(skillModelPins)
    .values({ companyId, skillId, modelVersion, pinnedReason: reason })
    .onConflictDoUpdate({
      target: [skillModelPins.skillId, skillModelPins.companyId],
      set: { modelVersion, pinnedReason: reason },
    });

  logger.info({ companyId, skillId, modelVersion, reason }, "model-pins: pin set");
}

// ── clearModelPin ─────────────────────────────────────────────────────────────

export async function clearModelPin(
  db:        Db,
  companyId: string,
  skillId:   string,
): Promise<void> {
  await (db as any)
    .delete(skillModelPins)
    .where(and(
      eq(skillModelPins.companyId, companyId),
      eq(skillModelPins.skillId, skillId),
    ));

  logger.info({ companyId, skillId }, "model-pins: pin cleared");
}
