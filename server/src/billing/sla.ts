/**
 * server/src/billing/sla.ts
 *
 * Gap N — SLA tiers (formally specced per CLAUDE.md).
 *
 * Resolution time: detected → operator receives plain-French explanation.
 * NOT from when operator reports — platform detects proactively.
 *
 * Breach compensation: 1 credit day per hour over limit, capped 10 days/month.
 */

import { and, eq, gte } from "drizzle-orm";
import { slaEvents, companies } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "sla" });

// ── SLA tier definitions ──────────────────────────────────────────────────────

export const SLA_TIERS = {
  solo:       { resolution_hours: 24, uptime_pct: 99.0, history_days: 90,   export_hours: 168 },
  growth:     { resolution_hours: 8,  uptime_pct: 99.5, history_days: 365,  export_hours: 48  },
  pro:        { resolution_hours: 4,  uptime_pct: 99.7, history_days: 730,  export_hours: 24  },
  enterprise: { resolution_hours: 1,  uptime_pct: 99.9, history_days: 1825, export_hours: 4   },
} as const;

export type PlanTier = keyof typeof SLA_TIERS;

// ── Breach recording ──────────────────────────────────────────────────────────

const MAX_CREDIT_DAYS_PER_MONTH = 10;

/**
 * Record an SLA breach and calculate compensation credit days.
 * Credit = 1 day per hour over limit, capped at MAX_CREDIT_DAYS_PER_MONTH.
 */
export async function recordSlaBreach(
  db:         Db,
  companyId:  string,
  plan:        PlanTier,
  metric:      string,
  thresholdValue: number,
  actualValue:    number,
): Promise<{ creditDays: number }> {
  const breachMinutes = Math.max(0, (actualValue - thresholdValue) * 60);
  const breachHours   = breachMinutes / 60;

  // Count existing credit days this calendar month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [existing] = await db
    .select({ total: slaEvents.creditDays })
    .from(slaEvents)
    .where(
      and(
        eq(slaEvents.companyId, companyId),
        eq(slaEvents.eventType, "breach"),
        gte(slaEvents.createdAt, monthStart),
      ),
    )
    .limit(1);

  const usedThisMonth = Number(existing?.total ?? 0);
  const rawCredit     = Math.floor(breachHours);
  const creditDays    = Math.min(rawCredit, MAX_CREDIT_DAYS_PER_MONTH - usedThisMonth);

  await db.insert(slaEvents).values({
    companyId,
    eventType:      "breach",
    plan,
    metric,
    thresholdValue: String(thresholdValue),
    actualValue:    String(actualValue),
    breachMinutes:  String(breachMinutes),
    creditDays,
  });

  logger.info({ companyId, plan, metric, breachMinutes, creditDays }, "sla: breach recorded");
  return { creditDays };
}

/**
 * Returns the SLA tier for a given plan slug.
 * Defaults to 'solo' for unknown plans.
 */
export function getSla(plan: string): typeof SLA_TIERS[PlanTier] {
  return SLA_TIERS[plan as PlanTier] ?? SLA_TIERS.solo;
}
