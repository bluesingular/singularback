/**
 * Gap A — Billing routes (Stripe checkout + portal).
 *
 * POST /companies/:companyId/billing/checkout
 *   Creates a Stripe Checkout session for the given plan.
 *   Returns { url } — client redirects to it. Null url means Stripe not configured.
 *
 * GET  /companies/:companyId/billing/portal
 *   Creates a Stripe billing portal session for an existing subscriber.
 *   Returns { url } or { url: null } if no stripeCustomerId on company.
 */

import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies, authUsers } from "@paperclipai/db";
import { createCheckoutSession, createBillingPortalSession } from "../billing/checkout.js";
import { unauthorized } from "../errors.js";

const checkoutBody = z.object({
  plan: z.enum(["growth", "pro"]).optional().default("growth"),
});

export function billingRoutes(db: Db): Router {
  const router = Router();

  // POST /companies/:companyId/billing/checkout
  router.post("/companies/:companyId/billing/checkout", async (req, res, next) => {
    try {
      const ctx = (req as any).ctx;
      if (!ctx?.userId) throw unauthorized();

      const { companyId } = req.params;
      const { plan } = checkoutBody.parse(req.body);

      // Get user email for Stripe
      const [userRow] = await (db as any)
        .select({ email: authUsers.email })
        .from(authUsers)
        .where(eq(authUsers.id, ctx.userId))
        .limit(1);

      const result = await createCheckoutSession({
        companyId,
        userId: ctx.userId,
        email: userRow?.email ?? "",
        plan,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /companies/:companyId/billing/portal
  router.get("/companies/:companyId/billing/portal", async (req, res, next) => {
    try {
      const ctx = (req as any).ctx;
      if (!ctx?.userId) throw unauthorized();

      const { companyId } = req.params;

      const [company] = await (db as any)
        .select({ stripeCustomerId: companies.stripeCustomerId })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (!company?.stripeCustomerId) {
        return res.json({ url: null });
      }

      const result = await createBillingPortalSession({
        stripeCustomerId: company.stripeCustomerId,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
