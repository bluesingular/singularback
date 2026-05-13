/**
 * PATCH /admin/tenants/:companyId/plan
 * Admin-only: override a tenant's plan and usage limits directly.
 */

import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { companies } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { forbidden, notFound } from "../errors.js";

const PLAN_LIMITS = {
  solo:       { tasksLimitMonth: 500,   tokensLimitMonth: 5_000_000,   maxAgents: 2   },
  growth:     { tasksLimitMonth: 2_000, tokensLimitMonth: 20_000_000,  maxAgents: 6   },
  pro:        { tasksLimitMonth: 6_000, tokensLimitMonth: 60_000_000,  maxAgents: 15  },
  enterprise: { tasksLimitMonth: 99_999, tokensLimitMonth: 999_000_000, maxAgents: 999 },
} as const;

const PlanPatchSchema = z.object({
  plan:            z.enum(["solo", "growth", "pro", "enterprise"]).optional(),
  tasksLimitMonth: z.number().int().positive().optional(),
  tokensLimitMonth: z.number().int().positive().optional(),
});

function assertAdmin(req: any) {
  if (req.actor.type !== "board") throw forbidden("Board access required");
  if (!req.actor.isInstanceAdmin && req.actor.source !== "local_implicit") {
    throw forbidden("Instance admin access required");
  }
}

export function adminPlanRoutes(db: Db) {
  const router = Router();

  // GET /admin/tenants/:companyId/plan
  router.get("/admin/tenants/:companyId/plan", async (req, res) => {
    assertAdmin(req);
    const { companyId } = req.params as { companyId: string };

    const [company] = await db
      .select({
        id:              companies.id,
        name:            companies.name,
        plan:            companies.plan,
        tasksUsedMonth:  companies.tasksUsedMonth,
        tasksLimitMonth: companies.tasksLimitMonth,
        tokensUsedMonth: companies.tokensUsedMonth,
        tokensLimitMonth: companies.tokensLimitMonth,
        stripeCustomerId: companies.stripeCustomerId,
        stripeSubId:      companies.stripeSubId,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) throw notFound("Company not found");
    res.json(company);
  });

  // PATCH /admin/tenants/:companyId/plan
  router.patch("/admin/tenants/:companyId/plan", async (req, res) => {
    assertAdmin(req);
    const { companyId } = req.params as { companyId: string };

    const parsed = PlanPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }

    const updates: Record<string, unknown> = {};

    if (parsed.data.plan) {
      const defaults = PLAN_LIMITS[parsed.data.plan];
      updates.plan            = parsed.data.plan;
      updates.tasksLimitMonth = parsed.data.tasksLimitMonth ?? defaults.tasksLimitMonth;
      updates.tokensLimitMonth = parsed.data.tokensLimitMonth ?? defaults.tokensLimitMonth;
    } else {
      if (parsed.data.tasksLimitMonth)  updates.tasksLimitMonth  = parsed.data.tasksLimitMonth;
      if (parsed.data.tokensLimitMonth) updates.tokensLimitMonth = parsed.data.tokensLimitMonth;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    const [updated] = await db
      .update(companies)
      .set(updates as any)
      .where(eq(companies.id, companyId))
      .returning({
        id:              companies.id,
        plan:            companies.plan,
        tasksLimitMonth: companies.tasksLimitMonth,
        tokensLimitMonth: companies.tokensLimitMonth,
      });

    if (!updated) throw notFound("Company not found");
    res.json({ ...updated, planLimits: PLAN_LIMITS });
  });

  return router;
}

export { PLAN_LIMITS };
