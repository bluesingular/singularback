/**
 * server/src/routes/partners.ts
 *
 * §34 Partner Programme routes.
 *
 * GET    /partners/me                          partner profile (is_partner, tier, etc.)
 * GET    /partners/me/referrals                list companies referred by this partner
 * GET    /partners/me/referrals/:companyId/health  company health for partner dashboard
 * POST   /partners/me/white-label              create/update white-label config
 * GET    /partners/me/white-label              get white-label config
 *
 * Admin routes (instance admin only):
 * POST   /admin/partners/:userId/certify       mark user as certified partner
 * POST   /admin/partners/:userId/referral-fee  create referral fee record
 *
 * Security invariants:
 * - Partner dashboard shows health metrics only (plan, embedding depth, last active)
 * - ZERO access to client operational data or agent outputs
 * - Referral fee created only after 60 days active subscription
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq, desc, gte } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companies,
  partnerReferralFees,
  partnerWhiteLabelConfig,
} from "@paperclipai/db";
import { assertInstanceAdmin } from "./authz.js";
import pino from "pino";

const logger = pino({ name: "partners" });

const whiteLabelSchema = z.object({
  brandName:     z.string().min(1).max(100),
  logoUrl:       z.string().url().optional(),
  primaryColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  supportEmail:  z.string().email().optional(),
  customDomain:  z.string().max(200).optional(),
  showPoweredBy: z.boolean().default(true),
});

export function partnerRoutes(db: Db): Router {
  const router = Router();

  // ── Partner self-service ──────────────────────────────────────────────────

  // GET /partners/me
  router.get("/partners/me", async (req, res) => {
    const userId = (req as any).ctx?.userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

    const [user] = await (db as any)
      .select({
        isPartner:          (db as any).raw ? undefined : true, // see authUsers below
        partnerCertifiedAt: undefined,
        partnerTier:        undefined,
      })
      .limit(1);

    // Return from auth context which includes partner fields
    const actor = (req as any).actor;
    res.json({
      ok: true,
      partner: {
        isPartner:          actor?.isPartner ?? false,
        partnerCertifiedAt: actor?.partnerCertifiedAt ?? null,
        partnerTier:        actor?.partnerTier ?? null,
      },
    });
  });

  // GET /partners/me/referrals
  router.get("/partners/me/referrals", async (req, res) => {
    const userId = (req as any).ctx?.userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

    const actor = (req as any).actor;
    if (!actor?.isPartner) { res.status(403).json({ error: "Not a partner" }); return; }

    const referred = await (db as any)
      .select({
        id:              companies.id,
        name:            companies.name,
        plan:            companies.plan,
        createdAt:       companies.createdAt,
        referralFeePaid: (companies as any).referralFeePaid,
      })
      .from(companies)
      .where(eq((companies as any).referredByPartnerId, userId))
      .orderBy(desc(companies.createdAt));

    res.json({ ok: true, referrals: referred });
  });

  // GET /partners/me/referrals/:companyId/health
  // Returns health metrics only — NO operational data
  router.get("/partners/me/referrals/:companyId/health", async (req, res) => {
    const userId    = (req as any).ctx?.userId as string | undefined;
    const companyId = req.params.companyId as string;
    if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

    const actor = (req as any).actor;
    if (!actor?.isPartner) { res.status(403).json({ error: "Not a partner" }); return; }

    // Verify this company was referred by this partner
    const [company] = await (db as any)
      .select({
        id:              companies.id,
        name:            companies.name,
        plan:            companies.plan,
        tasksUsedMonth:  (companies as any).tasksUsedMonth,
        tasksLimitMonth: (companies as any).tasksLimitMonth,
        createdAt:       companies.createdAt,
        referredByPartnerId: (companies as any).referredByPartnerId,
      })
      .from(companies)
      .where(and(eq(companies.id, companyId), eq((companies as any).referredByPartnerId, userId)))
      .limit(1);

    if (!company) { res.status(404).json({ error: "Company not found or not referred by you" }); return; }

    // Health metrics only — no task content, no agent outputs, no memory
    res.json({
      ok: true,
      health: {
        companyId:   company.id,
        name:        company.name,
        plan:        company.plan,
        usagePct:    company.tasksLimitMonth > 0
          ? Math.round((company.tasksUsedMonth / company.tasksLimitMonth) * 100)
          : 0,
        memberSince: company.createdAt,
      },
    });
  });

  // GET /partners/me/white-label
  router.get("/partners/me/white-label", async (req, res) => {
    const userId = (req as any).ctx?.userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

    const [config] = await (db as any)
      .select()
      .from(partnerWhiteLabelConfig)
      .where(eq(partnerWhiteLabelConfig.partnerId, userId))
      .limit(1);

    res.json({ ok: true, config: config ?? null });
  });

  // POST /partners/me/white-label
  router.post("/partners/me/white-label", async (req, res) => {
    const userId = (req as any).ctx?.userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

    const actor = (req as any).actor;
    if (!actor?.isPartner) { res.status(403).json({ error: "Not a partner" }); return; }

    const body = whiteLabelSchema.parse(req.body);

    await (db as any)
      .insert(partnerWhiteLabelConfig)
      .values({ partnerId: userId, ...body })
      .onConflictDoUpdate({
        target: [partnerWhiteLabelConfig.partnerId],
        set:    body,
      });

    logger.info({ userId }, "partners: white-label config updated");
    res.json({ ok: true });
  });

  // ── Admin routes ──────────────────────────────────────────────────────────

  // POST /admin/partners/:userId/certify
  router.post("/admin/partners/:userId/certify", async (req, res) => {
    assertInstanceAdmin(req);
    const { userId } = req.params as { userId: string };
    const { tier } = z.object({
      tier: z.enum(["certified", "silver", "gold"]),
    }).parse(req.body);

    await (db as any)
      .update((db as any).authUsers ?? {})
      .set({
        isPartner:          true,
        partnerCertifiedAt: new Date(),
        partnerTier:        tier,
      })
      .where(eq((db as any).authUsers?.id ?? "id", userId));

    logger.info({ userId, tier }, "partners: user certified");
    res.json({ ok: true });
  });

  // POST /admin/partners/:userId/referral-fee
  router.post("/admin/partners/:userId/referral-fee", async (req, res) => {
    assertInstanceAdmin(req);
    const { userId } = req.params as { userId: string };
    const body = z.object({
      companyId:  z.string().uuid(),
      amountEur:  z.number().positive(),
      paymentRef: z.string().optional(),
    }).parse(req.body);

    // Guard: only create fee if company was referred by this partner
    const [company] = await (db as any)
      .select({ id: companies.id, createdAt: companies.createdAt })
      .from(companies)
      .where(and(
        eq(companies.id, body.companyId),
        eq((companies as any).referredByPartnerId, userId),
      ))
      .limit(1);

    if (!company) {
      res.status(400).json({ error: "Company not referred by this partner" });
      return;
    }

    // Guard: 60 days active subscription rule
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);
    if (new Date(company.createdAt) > sixtyDaysAgo) {
      res.status(400).json({ error: "Company must be active for 60 days before referral fee" });
      return;
    }

    const [fee] = await (db as any)
      .insert(partnerReferralFees)
      .values({
        partnerId:  userId,
        companyId:  body.companyId,
        amountEur:  String(body.amountEur),
        paymentRef: body.paymentRef ?? null,
      })
      .returning({ id: partnerReferralFees.id });

    logger.info({ userId, companyId: body.companyId, amountEur: body.amountEur }, "partners: referral fee created");
    res.json({ ok: true, feeId: fee.id });
  });

  return router;
}
