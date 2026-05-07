/**
 * Gap D — Skill management system (admin routes).
 *
 * All routes require isInstanceAdmin.
 * Skills are scoped to a company; use ?companyId= for all endpoints.
 *
 * GET  /admin/skills/pending                              → all pending_approval versions across companies
 * GET  /admin/skills/:skillType/versions?companyId=       → version history
 * POST /admin/skills/:skillType/versions?companyId=       → create draft version
 * GET  /admin/skills/:skillType/versions/:id             → version detail
 * PATCH /admin/skills/:skillType/versions/:id             → update draft content
 * POST /admin/skills/:skillType/versions/:id/publish      → advance: draft→review→staging→active
 * POST /admin/skills/:skillType/versions/:id/rollback     → re-activate a deprecated version
 * POST /admin/skills/:skillType/versions/:id/approve      → approve pending_approval (Tier A)
 * POST /admin/skills/:skillType/versions/:id/reject       → reject any non-active version
 * GET  /admin/skills/:skillType/golden-datasets?companyId= → list golden examples
 * POST /admin/skills/:skillType/golden-datasets?companyId= → add golden example
 * DELETE /admin/skills/:skillType/golden-datasets/:itemId  → remove example
 */

import { Router } from "express";
import { eq, and, isNull, desc, ne } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { skillVersions, goldenDatasets, companies } from "@paperclipai/db";
import { assertInstanceAdmin } from "./authz.js";
import { notFound, badRequest } from "../errors.js";
import pino from "pino";

const log = pino({ name: "admin-skills" });

// ── Validation schemas ────────────────────────────────────────────────────────

const createVersionBody = z.object({
  version:     z.string().min(1),
  promptBody:  z.string().min(1),
  frontmatter: z.record(z.unknown()).default({}),
  triggerReason: z.enum(["manual", "low_trust", "damage_control"]).default("manual"),
});

const updateVersionBody = z.object({
  promptBody:  z.string().min(1).optional(),
  frontmatter: z.record(z.unknown()).optional(),
});

const createGoldenBody = z.object({
  input:          z.record(z.unknown()),
  expectedOutput: z.record(z.unknown()),
  qualityScore:   z.number().int().min(1).max(5).optional(),
  notes:          z.string().optional(),
});

// Status transition map for publish flow
const PUBLISH_TRANSITIONS: Record<string, string> = {
  draft:    "review",
  review:   "staging",
  staging:  "active",
};

// ── Route factory ─────────────────────────────────────────────────────────────

export function adminSkillRoutes(db: Db): Router {
  const router = Router();

  // Require instance admin for all routes
  router.use((req, res, next) => {
    try {
      assertInstanceAdmin(req);
      next();
    } catch (err) {
      next(err);
    }
  });

  // ── GET /admin/skills/pending — review queue ──────────────────────────────
  router.get("/admin/skills/pending", async (req, res, next) => {
    try {
      const rows = await (db as any)
        .select({
          id:           skillVersions.id,
          companyId:    skillVersions.companyId,
          skillType:    skillVersions.skillType,
          version:      skillVersions.version,
          status:       skillVersions.status,
          benchmarkScore: skillVersions.benchmarkScore,
          triggerReason:  skillVersions.triggerReason,
          createdAt:    skillVersions.createdAt,
          companyName:  companies.name,
        })
        .from(skillVersions)
        .innerJoin(companies, eq(companies.id, skillVersions.companyId))
        .where(eq(skillVersions.status, "pending_approval"))
        .orderBy(desc(skillVersions.createdAt));

      res.json({ versions: rows });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /admin/skills/:skillType/versions ─────────────────────────────────
  router.get("/admin/skills/:skillType/versions", async (req, res, next) => {
    try {
      const { skillType } = req.params;
      const { companyId } = req.query as { companyId?: string };
      if (!companyId) throw badRequest("companyId query param required");

      const rows = await (db as any)
        .select({
          id:              skillVersions.id,
          version:         skillVersions.version,
          status:          skillVersions.status,
          benchmarkScore:  skillVersions.benchmarkScore,
          benchmarkItemCount: skillVersions.benchmarkItemCount,
          triggerReason:   skillVersions.triggerReason,
          parentVersionId: skillVersions.parentVersionId,
          activatedAt:     skillVersions.activatedAt,
          createdAt:       skillVersions.createdAt,
        })
        .from(skillVersions)
        .where(and(
          eq(skillVersions.companyId, companyId),
          eq(skillVersions.skillType, skillType),
        ))
        .orderBy(desc(skillVersions.createdAt));

      res.json({ skillType, companyId, versions: rows });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /admin/skills/:skillType/versions ────────────────────────────────
  router.post("/admin/skills/:skillType/versions", async (req, res, next) => {
    try {
      const { skillType } = req.params;
      const { companyId } = req.query as { companyId?: string };
      if (!companyId) throw badRequest("companyId query param required");

      const body = createVersionBody.parse(req.body);

      // Find active version to set as parent
      const [active] = await (db as any)
        .select({ id: skillVersions.id })
        .from(skillVersions)
        .where(and(
          eq(skillVersions.companyId, companyId),
          eq(skillVersions.skillType, skillType),
          eq(skillVersions.status, "active"),
        ))
        .limit(1);

      const [row] = await (db as any)
        .insert(skillVersions)
        .values({
          companyId,
          skillType,
          version:         body.version,
          promptBody:      body.promptBody,
          frontmatter:     body.frontmatter,
          status:          "draft",
          triggerReason:   body.triggerReason,
          parentVersionId: active?.id ?? null,
        })
        .returning();

      log.info({ companyId, skillType, version: body.version }, "admin: draft skill version created");
      res.status(201).json({ version: row });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /admin/skills/:skillType/versions/:versionId ─────────────────────
  router.get("/admin/skills/:skillType/versions/:versionId", async (req, res, next) => {
    try {
      const { skillType, versionId } = req.params;

      const [row] = await (db as any)
        .select()
        .from(skillVersions)
        .where(and(
          eq(skillVersions.id, versionId),
          eq(skillVersions.skillType, skillType),
        ))
        .limit(1);

      if (!row) throw notFound("Skill version not found");

      // Load parent version for diff
      let parent = null;
      if (row.parentVersionId) {
        const [p] = await (db as any)
          .select({ id: skillVersions.id, version: skillVersions.version, promptBody: skillVersions.promptBody })
          .from(skillVersions)
          .where(eq(skillVersions.id, row.parentVersionId))
          .limit(1);
        parent = p ?? null;
      }

      res.json({ version: row, parent });
    } catch (err) {
      next(err);
    }
  });

  // ── PATCH /admin/skills/:skillType/versions/:versionId ───────────────────
  router.patch("/admin/skills/:skillType/versions/:versionId", async (req, res, next) => {
    try {
      const { skillType, versionId } = req.params;
      const body = updateVersionBody.parse(req.body);

      const [existing] = await (db as any)
        .select({ status: skillVersions.status })
        .from(skillVersions)
        .where(eq(skillVersions.id, versionId))
        .limit(1);

      if (!existing) throw notFound("Skill version not found");
      if (existing.status !== "draft" && existing.status !== "review") {
        throw badRequest(`Cannot edit a version in '${existing.status}' status`);
      }

      const patch: Record<string, unknown> = {};
      if (body.promptBody  !== undefined) patch.promptBody  = body.promptBody;
      if (body.frontmatter !== undefined) patch.frontmatter = body.frontmatter;

      const [updated] = await (db as any)
        .update(skillVersions)
        .set(patch)
        .where(eq(skillVersions.id, versionId))
        .returning();

      res.json({ version: updated });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /admin/skills/:skillType/versions/:versionId/publish ────────────
  // Advances status through: draft → review → staging → active
  router.post("/admin/skills/:skillType/versions/:versionId/publish", async (req, res, next) => {
    try {
      const { versionId } = req.params;

      const [existing] = await (db as any)
        .select({ status: skillVersions.status, companyId: skillVersions.companyId, skillType: skillVersions.skillType })
        .from(skillVersions)
        .where(eq(skillVersions.id, versionId))
        .limit(1);

      if (!existing) throw notFound("Skill version not found");

      const nextStatus = PUBLISH_TRANSITIONS[existing.status];
      if (!nextStatus) {
        throw badRequest(`Version in '${existing.status}' cannot be published further`);
      }

      // If activating (staging → active), deprecate current active version
      if (nextStatus === "active") {
        await (db as any)
          .update(skillVersions)
          .set({ status: "deprecated" })
          .where(and(
            eq(skillVersions.companyId, existing.companyId),
            eq(skillVersions.skillType, existing.skillType),
            eq(skillVersions.status, "active"),
            ne(skillVersions.id, versionId),
          ));
      }

      const activatedAt = nextStatus === "active" ? new Date() : null;
      const patch: Record<string, unknown> = { status: nextStatus };
      if (activatedAt) patch.activatedAt = activatedAt;

      const [updated] = await (db as any)
        .update(skillVersions)
        .set(patch)
        .where(eq(skillVersions.id, versionId))
        .returning();

      log.info({ versionId, from: existing.status, to: nextStatus }, "admin: skill version published");
      res.json({ version: updated });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /admin/skills/:skillType/versions/:versionId/rollback ───────────
  router.post("/admin/skills/:skillType/versions/:versionId/rollback", async (req, res, next) => {
    try {
      const { versionId } = req.params;

      const [existing] = await (db as any)
        .select({ status: skillVersions.status, companyId: skillVersions.companyId, skillType: skillVersions.skillType })
        .from(skillVersions)
        .where(eq(skillVersions.id, versionId))
        .limit(1);

      if (!existing) throw notFound("Skill version not found");
      if (existing.status === "active") throw badRequest("Version is already active");

      // Deprecate current active
      await (db as any)
        .update(skillVersions)
        .set({ status: "deprecated" })
        .where(and(
          eq(skillVersions.companyId, existing.companyId),
          eq(skillVersions.skillType, existing.skillType),
          eq(skillVersions.status, "active"),
        ));

      const [updated] = await (db as any)
        .update(skillVersions)
        .set({ status: "active", activatedAt: new Date() })
        .where(eq(skillVersions.id, versionId))
        .returning();

      log.info({ versionId }, "admin: skill version rolled back");
      res.json({ version: updated });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /admin/skills/:skillType/versions/:versionId/approve ────────────
  router.post("/admin/skills/:skillType/versions/:versionId/approve", async (req, res, next) => {
    try {
      const { versionId } = req.params;

      const [existing] = await (db as any)
        .select({ status: skillVersions.status, companyId: skillVersions.companyId, skillType: skillVersions.skillType })
        .from(skillVersions)
        .where(eq(skillVersions.id, versionId))
        .limit(1);

      if (!existing) throw notFound("Skill version not found");
      if (existing.status !== "pending_approval") {
        throw badRequest(`Cannot approve a version in '${existing.status}' status`);
      }

      // Deprecate current active
      await (db as any)
        .update(skillVersions)
        .set({ status: "deprecated" })
        .where(and(
          eq(skillVersions.companyId, existing.companyId),
          eq(skillVersions.skillType, existing.skillType),
          eq(skillVersions.status, "active"),
        ));

      const [updated] = await (db as any)
        .update(skillVersions)
        .set({ status: "active", activatedAt: new Date() })
        .where(eq(skillVersions.id, versionId))
        .returning();

      log.info({ versionId }, "admin: pending_approval skill version approved");
      res.json({ version: updated });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /admin/skills/:skillType/versions/:versionId/reject ─────────────
  router.post("/admin/skills/:skillType/versions/:versionId/reject", async (req, res, next) => {
    try {
      const { versionId } = req.params;

      const [existing] = await (db as any)
        .select({ status: skillVersions.status })
        .from(skillVersions)
        .where(eq(skillVersions.id, versionId))
        .limit(1);

      if (!existing) throw notFound("Skill version not found");
      if (existing.status === "active" || existing.status === "deprecated") {
        throw badRequest(`Cannot reject a version in '${existing.status}' status`);
      }

      const [updated] = await (db as any)
        .update(skillVersions)
        .set({ status: "blocked" })
        .where(eq(skillVersions.id, versionId))
        .returning();

      log.info({ versionId }, "admin: skill version rejected");
      res.json({ version: updated });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /admin/skills/:skillType/golden-datasets ──────────────────────────
  router.get("/admin/skills/:skillType/golden-datasets", async (req, res, next) => {
    try {
      const { skillType } = req.params;
      const { companyId } = req.query as { companyId?: string };
      if (!companyId) throw badRequest("companyId query param required");

      const rows = await (db as any)
        .select()
        .from(goldenDatasets)
        .where(and(
          eq(goldenDatasets.companyId, companyId),
          eq(goldenDatasets.skillType, skillType),
        ))
        .orderBy(desc(goldenDatasets.createdAt));

      res.json({ skillType, companyId, items: rows });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /admin/skills/:skillType/golden-datasets ─────────────────────────
  router.post("/admin/skills/:skillType/golden-datasets", async (req, res, next) => {
    try {
      const { skillType } = req.params;
      const { companyId } = req.query as { companyId?: string };
      if (!companyId) throw badRequest("companyId query param required");

      const body = createGoldenBody.parse(req.body);

      const [row] = await (db as any)
        .insert(goldenDatasets)
        .values({
          companyId,
          skillType,
          input:          body.input,
          expectedOutput: body.expectedOutput,
          qualityScore:   body.qualityScore ?? null,
          notes:          body.notes ?? null,
        })
        .returning();

      log.info({ companyId, skillType }, "admin: golden dataset item added");
      res.status(201).json({ item: row });
    } catch (err) {
      next(err);
    }
  });

  // ── DELETE /admin/skills/:skillType/golden-datasets/:itemId ──────────────
  router.delete("/admin/skills/:skillType/golden-datasets/:itemId", async (req, res, next) => {
    try {
      const { skillType, itemId } = req.params;

      await (db as any)
        .delete(goldenDatasets)
        .where(and(
          eq(goldenDatasets.id, itemId),
          eq(goldenDatasets.skillType, skillType),
        ));

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
