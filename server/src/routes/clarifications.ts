/**
 * server/src/routes/clarifications.ts
 *
 * Human clarification flow — G5.
 *
 * POST /companies/:companyId/issues/:issueId/clarification
 *   Agent (or system) posts a question. Sets issue → awaiting_clarification,
 *   schedules a timeout job using company.clarificationTimeoutHours.
 *
 * POST /companies/:companyId/clarifications/:id/reply
 *   Human submits an answer. Cancels the timeout, sets status → answered,
 *   restores issue → in_progress, triggers agent heartbeat.
 *
 * GET /companies/:companyId/clarifications
 *   Returns all pending clarifications for the company (CEO Console feed).
 *
 * POST /companies/:companyId/clarifications/:id/cancel
 *   Owner/admin cancels a pending clarification (sets issue → blocked).
 */

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import pino from "pino";
import { clarificationRequests, issues, companies, agents } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess, requireRole } from "./authz.js";
import { emit } from "../queue/emit.js";

const logger = pino({ name: "clarification-routes" });

const AskSchema = z.object({
  question: z.string().min(1).max(2000),
  agentId:  z.string().uuid().optional(),
});

const ReplySchema = z.object({
  answer: z.string().min(1).max(5000),
});

export function clarificationRoutes(db: Db) {
  const router = Router();

  // ── POST /companies/:companyId/issues/:issueId/clarification ──────────────

  router.post("/companies/:companyId/issues/:issueId/clarification", async (req, res) => {
    const { companyId, issueId } = req.params as { companyId: string; issueId: string };
    assertCompanyAccess(req, companyId);

    const parsed = AskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { question, agentId } = parsed.data;

    // Load company for timeout setting
    const [company] = await db
      .select({ clarificationTimeoutHours: companies.clarificationTimeoutHours })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    // Verify issue belongs to this company
    const [issue] = await db
      .select({ id: issues.id, status: issues.status })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.companyId, companyId)))
      .limit(1);

    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }

    // Create the clarification request
    const [clarification] = await db
      .insert(clarificationRequests)
      .values({
        companyId,
        issueId,
        agentId: agentId ?? null,
        question,
        status: "pending",
      })
      .returning();

    // Set issue to awaiting_clarification
    await db
      .update(issues)
      .set({ status: "awaiting_clarification" })
      .where(eq(issues.id, issueId));

    // Schedule timeout job
    await emit.clarificationRequested({
      clarificationId: clarification.id,
      companyId,
      issueId,
      agentId: agentId ?? null,
      question,
      timeoutHours: company.clarificationTimeoutHours,
    });

    logger.info(
      { clarificationId: clarification.id, issueId, companyId, timeoutHours: company.clarificationTimeoutHours },
      "clarification: request created",
    );

    res.status(201).json(clarification);
  });

  // ── POST /companies/:companyId/clarifications/:id/reply ───────────────────

  router.post("/companies/:companyId/clarifications/:id/reply", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);

    const parsed = ReplySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { answer } = parsed.data;
    const userId = (req as any).actor?.userId as string | undefined;

    const [clarification] = await db
      .select()
      .from(clarificationRequests)
      .where(
        and(
          eq(clarificationRequests.id, id),
          eq(clarificationRequests.companyId, companyId),
        ),
      )
      .limit(1);

    if (!clarification) {
      res.status(404).json({ error: "Clarification not found" });
      return;
    }

    if (clarification.status !== "pending") {
      res.status(409).json({ error: "Clarification already resolved", status: clarification.status });
      return;
    }

    // Record the answer
    await db
      .update(clarificationRequests)
      .set({
        status:     "answered",
        answer,
        answeredBy: userId ?? null,
        answeredAt: new Date(),
      })
      .where(eq(clarificationRequests.id, id));

    // Cancel the pending timeout job
    await emit.cancelClarificationTimeout(id);

    // Restore issue to in_progress
    await db
      .update(issues)
      .set({ status: "in_progress" })
      .where(and(eq(issues.id, clarification.issueId), eq(issues.companyId, companyId)));

    // Wake the agent if one was specified
    if (clarification.agentId) {
      await emit.heartbeat(
        { agentId: clarification.agentId, companyId, triggeredBy: "approval" },
        0,
      );
    }

    logger.info(
      { clarificationId: id, issueId: clarification.issueId, agentId: clarification.agentId },
      "clarification: answered — agent heartbeat dispatched",
    );

    res.json({ ok: true });
  });

  // ── GET /companies/:companyId/clarifications ──────────────────────────────

  router.get("/companies/:companyId/clarifications", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const { status = "pending" } = req.query as { status?: string };

    const rows = await db
      .select()
      .from(clarificationRequests)
      .where(
        and(
          eq(clarificationRequests.companyId, companyId),
          eq(clarificationRequests.status, status),
        ),
      );

    res.json(rows);
  });

  // ── POST /companies/:companyId/clarifications/:id/cancel ─────────────────

  router.post("/companies/:companyId/clarifications/:id/cancel", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "admin");

    const [clarification] = await db
      .select()
      .from(clarificationRequests)
      .where(
        and(
          eq(clarificationRequests.id, id),
          eq(clarificationRequests.companyId, companyId),
        ),
      )
      .limit(1);

    if (!clarification) {
      res.status(404).json({ error: "Clarification not found" });
      return;
    }

    if (clarification.status !== "pending") {
      res.status(409).json({ error: "Clarification already resolved", status: clarification.status });
      return;
    }

    await db
      .update(clarificationRequests)
      .set({ status: "cancelled" })
      .where(eq(clarificationRequests.id, id));

    await emit.cancelClarificationTimeout(id);

    // Set issue to blocked (admin chose to stop waiting)
    await db
      .update(issues)
      .set({ status: "blocked" })
      .where(and(eq(issues.id, clarification.issueId), eq(issues.companyId, companyId)));

    logger.info({ clarificationId: id, issueId: clarification.issueId }, "clarification: cancelled by admin");

    res.json({ ok: true });
  });

  return router;
}
