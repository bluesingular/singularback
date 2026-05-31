/**
 * server/src/packs/migrations.ts
 *
 * Gap J — Pack update migration path.
 *
 * Migration steps declared in pack.json — run atomically on update approval.
 * Transaction rules:
 *   ✓ Run as single atomic transaction
 *   ✓ Required wizard questions block until answered
 *   ✓ Rollback entirely if any step fails
 *   ❌ NEVER delete org_memory, task history, or core Company DNA fields
 */

import type { Db } from "@paperclipai/db";
import { companyDna } from "@paperclipai/db";
// pack_extensions (A3) stores pack-declared DNA extensions
import { eq, and } from "drizzle-orm";
import pino from "pino";

const logger = pino({ name: "pack-migrations" });

export type MigrationStepType =
  | "add_wizard_question"     // surfaces in mini-wizard, optional or required
  | "rename_dna_field"        // auto-migrate existing values
  | "deprecate_dna_field"     // archive, NEVER delete
  | "add_agent"               // onboard alongside existing agents
  | "remove_skill"            // deactivate gracefully
  | "update_quality_threshold";

export interface MigrationStep {
  type:       MigrationStepType;
  params:     Record<string, unknown>;
  required?:  boolean;   // if true, operator must answer before migration proceeds
}

export interface PackMigration {
  fromVersion: string;
  toVersion:   string;
  steps:       MigrationStep[];
}

export class PackMigrationError extends Error {
  constructor(
    message: string,
    public readonly step: MigrationStep,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PackMigrationError";
  }
}

/**
 * Execute a pack migration atomically.
 * Rolls back entirely if any step fails.
 * NEVER deletes org_memory, task history, or core DNA fields.
 */
export async function applyPackMigration(
  db:        Db,
  companyId: string,
  migration: PackMigration,
  answers:   Record<string, unknown> = {},
): Promise<{ appliedSteps: number }> {
  let appliedSteps = 0;

  await (db as any).transaction(async (tx: Db) => {
    for (const step of migration.steps) {
      try {
        await applyStep(tx, companyId, step, answers);
        appliedSteps++;
      } catch (err) {
        throw new PackMigrationError(
          `Migration step '${step.type}' failed: ${(err as Error).message}`,
          step,
          err,
        );
      }
    }
  });

  logger.info(
    { companyId, fromVersion: migration.fromVersion, toVersion: migration.toVersion, appliedSteps },
    "pack-migration: complete",
  );

  return { appliedSteps };
}

async function applyStep(
  db:        Db,
  companyId: string,
  step:      MigrationStep,
  answers:   Record<string, unknown>,
): Promise<void> {
  switch (step.type) {
    case "rename_dna_field": {
      const { from, to } = step.params as { from: string; to: string };
      // Load current pack_extensions (A3), rename the field
      const [row] = await (db as any)
        .select({ packExtensions: companyDna.packExtensions })
        .from(companyDna)
        .where(eq(companyDna.companyId, companyId))
        .limit(1);

      if (row?.packExtensions && typeof row.packExtensions === "object") {
        const fields = row.packExtensions as Record<string, unknown>;
        if (from in fields) {
          const val = fields[from];
          delete fields[from];
          fields[to] = val;
          await (db as any)
            .update(companyDna)
            .set({ packExtensions: fields })
            .where(eq(companyDna.companyId, companyId));
        }
      }
      logger.info({ companyId, from, to }, "pack-migration: DNA field renamed");
      break;
    }

    case "deprecate_dna_field": {
      const { field } = step.params as { field: string };
      const [row] = await (db as any)
        .select({ packExtensions: companyDna.packExtensions })
        .from(companyDna)
        .where(eq(companyDna.companyId, companyId))
        .limit(1);

      if (row?.packExtensions && typeof row.packExtensions === "object") {
        const fields = row.packExtensions as Record<string, unknown>;
        if (field in fields) {
          // Archive by prefixing with _deprecated_ — NEVER delete
          fields[`_deprecated_${field}`] = fields[field];
          delete fields[field];
          await (db as any)
            .update(companyDna)
            .set({ packExtensions: fields })
            .where(eq(companyDna.companyId, companyId));
        }
      }
      logger.info({ companyId, field }, "pack-migration: DNA field deprecated (archived)");
      break;
    }

    case "add_wizard_question": {
      const { key, required } = step.params as { key: string; required?: boolean };
      if (required && !(key in answers)) {
        throw new Error(`Required wizard question not answered: ${key}`);
      }

      if (key in answers) {
        const [row] = await (db as any)
          .select({ packExtensions: companyDna.packExtensions })
          .from(companyDna)
          .where(eq(companyDna.companyId, companyId))
          .limit(1);

        const fields = (row?.packExtensions as Record<string, unknown>) ?? {};
        fields[key] = answers[key];
        await (db as any)
          .update(companyDna)
          .set({ packExtensions: fields })
          .where(eq(companyDna.companyId, companyId));
      }
      break;
    }

    case "update_quality_threshold":
    case "remove_skill":
    case "add_agent":
      // These require deeper wiring with the pack installer — log and skip for now
      logger.info({ companyId, stepType: step.type }, "pack-migration: step noted (deferred)");
      break;

    default:
      logger.warn({ companyId, stepType: step.type }, "pack-migration: unknown step type — skipped");
  }
}
