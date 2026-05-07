/**
 * server/src/routes/trust.ts
 *
 * Trust calibration API — M9.
 *
 * GET  /companies/:companyId/trust               → all trust scores + proposals for the company
 * POST /companies/:companyId/trust/proposals/:id/approve  → approve an autonomy upgrade
 * POST /companies/:companyId/trust/proposals/:id/reject   → reject a proposal
 */

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { trustScores, trustProposals } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess, requireRole } from "./authz.js";
import pino from "pino";

const logger = pino({ name: "trust-routes" });

export function trustRoutes(db: Db) {
  const router = Router();

  // GET /companies/:companyId/trust
  // Returns all trust scores and pending proposals for this company.
  router.get("/companies/:companyId/trust", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const [scores, proposals] = await Promise.all([
      (db as any)
        .select()
        .from(trustScores)
        .where(eq(trustScores.companyId, companyId)),
      (db as any)
        .select()
        .from(trustProposals)
        .where(
          and(
            eq(trustProposals.companyId, companyId),
            eq(trustProposals.status, "pending"),
          ),
        ),
    ]);

    res.json({ scores, proposals });
  });

  // POST /companies/:companyId/trust/proposals/:proposalId/approve
  router.post(
    "/companies/:companyId/trust/proposals/:proposalId/approve",
    async (req, res) => {
      const { companyId, proposalId } = req.params as {
        companyId: string;
        proposalId: string;
      };
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const [proposal] = await (db as any)
        .select()
        .from(trustProposals)
        .where(
          and(
            eq(trustProposals.id, proposalId),
            eq(trustProposals.companyId, companyId),
            eq(trustProposals.status, "pending"),
          ),
        )
        .limit(1);

      if (!proposal) {
        res.status(404).json({ error: "Proposal not found" });
        return;
      }

      // Approve: update trust score autonomy level + mark proposal reviewed
      await Promise.all([
        (db as any)
          .update(trustScores)
          .set({ autonomyLevel: proposal.proposedLevel, updatedAt: new Date() })
          .where(
            and(
              eq(trustScores.agentId, proposal.agentId),
              eq(trustScores.skillType, proposal.skillType),
            ),
          ),
        (db as any)
          .update(trustProposals)
          .set({
            status: "approved",
            reviewedAt: new Date(),
            reviewedBy: req.actor.userId ?? null,
          })
          .where(eq(trustProposals.id, proposalId)),
      ]);

      logger.info({ companyId, proposalId }, "trust-routes: proposal approved");
      res.json({ ok: true });
    },
  );

  // POST /companies/:companyId/trust/proposals/:proposalId/reject
  router.post(
    "/companies/:companyId/trust/proposals/:proposalId/reject",
    async (req, res) => {
      const { companyId, proposalId } = req.params as {
        companyId: string;
        proposalId: string;
      };
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const updated = await (db as any)
        .update(trustProposals)
        .set({
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy: req.actor.userId ?? null,
        })
        .where(
          and(
            eq(trustProposals.id, proposalId),
            eq(trustProposals.companyId, companyId),
            eq(trustProposals.status, "pending"),
          ),
        )
        .returning({ id: trustProposals.id });

      if (!updated?.length) {
        res.status(404).json({ error: "Proposal not found" });
        return;
      }

      logger.info({ companyId, proposalId }, "trust-routes: proposal rejected");
      res.json({ ok: true });
    },
  );

  return router;
}
