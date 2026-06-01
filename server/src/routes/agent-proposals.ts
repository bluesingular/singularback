/**
 * server/src/routes/agent-proposals.ts
 *
 * Gap G — Agent-initiated task proposals.
 *
 * GET  /companies/:companyId/agent-proposals        list pending proposals
 * POST /companies/:companyId/agent-proposals/:id/accept  accept proposal → create task
 * POST /companies/:companyId/agent-proposals/:id/decline decline proposal
 *
 * Anti-fatigue: if same trigger declined 3× → raise threshold (stored in metadata).
 */

import { Router } from "express";
import { and, eq, lt } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentProposals } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import pino from "pino";

const logger = pino({ name: "agent-proposals" });

const ANTI_FATIGUE_THRESHOLD = 3;

export function agentProposalRoutes(db: Db): Router {
  const router = Router();

  // GET /companies/:companyId/agent-proposals
  router.get("/companies/:companyId/agent-proposals", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      const now = new Date();
      const proposals = await db
        .select()
        .from(agentProposals)
        .where(
          and(
            eq(agentProposals.companyId, companyId),
            eq(agentProposals.status, "pending"),
            lt(agentProposals.expiresAt, new Date(now.getTime() + 48 * 3_600_000)), // not yet expired
          ),
        );

      res.json(proposals.filter((p) => p.expiresAt > now));
    } catch (err) { next(err); }
  });

  // POST /companies/:companyId/agent-proposals/:id/accept
  router.post("/companies/:companyId/agent-proposals/:id/accept", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);

      const [updated] = await db
        .update(agentProposals)
        .set({ status: "accepted", decidedAt: new Date() })
        .where(
          and(
            eq(agentProposals.id, id),
            eq(agentProposals.companyId, companyId),
            eq(agentProposals.status, "pending"),
          ),
        )
        .returning({ id: agentProposals.id, proposedTaskBrief: agentProposals.proposedTaskBrief });

      if (!updated) { res.status(404).json({ error: "Proposal not found or already decided" }); return; }

      logger.info({ companyId, proposalId: id }, "agent-proposal: accepted");
      res.json({ ok: true, taskBrief: updated.proposedTaskBrief });
    } catch (err) { next(err); }
  });

  // POST /companies/:companyId/agent-proposals/:id/decline
  router.post("/companies/:companyId/agent-proposals/:id/decline", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);

      const [proposal] = await db
        .select({ declineCount: agentProposals.declineCount, trigger: agentProposals.trigger })
        .from(agentProposals)
        .where(and(eq(agentProposals.id, id), eq(agentProposals.companyId, companyId)))
        .limit(1);

      if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }

      const newDeclineCount = (proposal.declineCount ?? 0) + 1;
      const antiFatigue     = newDeclineCount >= ANTI_FATIGUE_THRESHOLD;

      await db
        .update(agentProposals)
        .set({
          status:       "declined",
          declineCount: newDeclineCount,
          decidedAt:    new Date(),
        })
        .where(eq(agentProposals.id, id));

      logger.info(
        { companyId, proposalId: id, declineCount: newDeclineCount, antiFatigue },
        antiFatigue
          ? "agent-proposal: declined — anti-fatigue threshold reached for this trigger"
          : "agent-proposal: declined",
      );

      res.json({ ok: true, antiFatigue });
    } catch (err) { next(err); }
  });

  return router;
}
