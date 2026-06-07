/**
 * server/src/routes/task-inline-edit.ts
 *
 * Gap B — Inline output editing before approval.
 *
 * PATCH /companies/:companyId/tasks/:taskId/inline-edit
 *
 * Operator edits the agent's output directly in the task approval card.
 * This is the highest-signal training data available (weight 3.0).
 *
 * INVARIANT: Only creates a golden dataset example when content was actually
 * changed. Approving as-is produces ZERO training signal.
 *
 * Flow:
 *   1. Verify task belongs to company and is in pending_approval / in_review
 *   2. Verify edit differs from original output
 *   3. Write golden_datasets row:
 *      - input:        { brief: task.title }
 *      - expectedOutput: operator's corrected version
 *      - agentOutput:  original agent output (for diff analysis)
 *      - weight:       3.0
 *      - source:       'inline_approval_edit'
 *      - taskId:       task.id
 *      - skillType:    task.skillType ?? 'unknown'
 *   4. Return { ok: true, recorded: true, charCount }
 *
 * The edit is NOT persisted to the task itself — the operator approves the
 * corrected version by providing it to the downstream action, which is
 * handled separately. The golden dataset is the durable artifact.
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issues, goldenDatasets } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import { maybeExtractCorrectionPattern } from "../learning/pattern-from-corrections.js";
import pino from "pino";

const logger = pino({ name: "task-inline-edit" });

const INLINE_EDIT_WEIGHT = "3.0";   // highest training signal per spec
const INLINE_EDIT_SOURCE = "inline_approval_edit";

// States where an inline edit makes sense
const EDITABLE_STATUSES = ["pending_approval", "in_review"] as const;

const editBody = z.object({
  operatorEdit:   z.string().min(1, "Edit cannot be empty"),
  originalOutput: z.string().optional(),   // original agent output (for diff)
});

export function taskInlineEditRoutes(db: Db) {
  const router = Router();

  router.patch(
    "/companies/:companyId/tasks/:taskId/inline-edit",
    async (req, res, next) => {
      try {
        const { companyId, taskId } =
          req.params as { companyId: string; taskId: string };

        assertCompanyAccess(req, companyId);

        // ── 1. Load task ──────────────────────────────────────────────────────
        const task = await db
          .select({
            id:        issues.id,
            companyId: issues.companyId,
            title:     issues.title,
            status:    issues.status,
            skillType: issues.skillType,
            description: issues.description,   // current agent output
          })
          .from(issues)
          .where(and(eq(issues.id, taskId), eq(issues.companyId, companyId)))
          .then((rows) => rows[0] ?? null);

        if (!task) {
          res.status(404).json({ ok: false, error: "Tâche introuvable." });
          return;
        }

        // Only allow edits while the task is awaiting approval
        if (!EDITABLE_STATUSES.includes(task.status as typeof EDITABLE_STATUSES[number])) {
          res.status(409).json({
            ok:    false,
            error: "Cette tâche n'attend plus d'approbation.",
          });
          return;
        }

        // ── 2. Validate body ──────────────────────────────────────────────────
        const parsed = editBody.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            ok:    false,
            error: parsed.error.issues[0]?.message ?? "Corps de la requête invalide.",
          });
          return;
        }

        const { operatorEdit, originalOutput } = parsed.data;

        // Derive the original output: explicit param → task description → empty
        const agentOutput = originalOutput ?? task.description ?? "";

        // INVARIANT: no signal when no change
        if (operatorEdit === agentOutput) {
          res.json({
            ok:       true,
            recorded: false,
            message:  "Aucune modification détectée — aucun signal d'entraînement créé.",
          });
          return;
        }

        const charCount = Math.abs(operatorEdit.length - agentOutput.length);

        // ── 3. Write golden dataset entry ─────────────────────────────────────
        // weight 3.0 = operator saw output AND decided to change specific words
        await db.insert(goldenDatasets).values({
          companyId,
          skillType:      task.skillType ?? "unknown",
          input:          { brief: task.title ?? "" },
          expectedOutput: { text: operatorEdit },
          agentOutput:    agentOutput,
          weight:         INLINE_EDIT_WEIGHT,
          source:         INLINE_EDIT_SOURCE,
          taskId:         task.id,
          notes:          `Correction opérateur — ${charCount} caractère${charCount !== 1 ? "s" : ""} modifiés`,
        });

        logger.info(
          { companyId, taskId, skillType: task.skillType, charCount },
          "gap-b: inline edit recorded → golden dataset entry created (weight 3.0)",
        );

        // AG-6: fire-and-forget pattern extraction — enough corrections → LLM extracts pattern
        if (task.skillType) {
          void maybeExtractCorrectionPattern({ db, companyId, skillType: task.skillType })
            .catch((err) => logger.warn({ err, companyId, skillType: task.skillType }, "gap-b: pattern extraction failed (non-fatal)"));
        }

        res.json({ ok: true, recorded: true, charCount });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
