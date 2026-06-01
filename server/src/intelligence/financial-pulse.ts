/**
 * server/src/intelligence/financial-pulse.ts
 *
 * §18 — Financial Pulse intelligence.
 *
 * Synthesises financial health from org_memory entries tagged with
 * title prefix "[financial]" — seeded by accounting integration sync workers.
 *
 * Financial records are stored as JSON in memory_entries.content,
 * tagged with title: "[financial] invoice|payment|pipeline_deal".
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { memoryEntries, integrations } from "@paperclipai/db";
import type { CandidateCard } from "./sweep.js";
import pino from "pino";

const logger = pino({ name: "financial-pulse" });

export interface InvoiceAgingBucket {
  current:    number;
  days30:     number;
  days60:     number;
  days90plus: number;
}

export interface FinancialPulse {
  mrrEquivalent:      number | null;
  outstandingTotal:   number;
  aging:              InvoiceAgingBucket;
  top5Clients:        { name: string; revenueEur: number }[];
  cashProjection:     { days30: number; days60: number; days90: number } | null;
  invoicesAtRisk:     { contactName: string; amountEur: number; daysOverdue: number }[];
  hasConnectedSource: boolean;
  computedAt:         Date;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const FINANCIAL_INTEGRATIONS = ["sage", "pennylane", "quickbooks", "stripe", "hubspot", "paypal"];

export async function getFinancialPulse(db: Db, companyId: string): Promise<FinancialPulse> {
  const connected = await db.query.integrations.findMany({
    where: and(
      eq(integrations.companyId, companyId),
      eq(integrations.status, "connected"),
      sql`${integrations.type} = ANY(ARRAY['sage','pennylane','quickbooks','stripe','hubspot','paypal'])`,
    ),
    columns: { type: true },
  });

  if (connected.length === 0) return emptyPulse();

  const since = new Date(Date.now() - NINETY_DAYS_MS);
  const facts  = await db.query.memoryEntries.findMany({
    where: and(
      eq(memoryEntries.companyId, companyId),
      eq(memoryEntries.archived, false),
      gte(memoryEntries.createdAt, since),
      sql`${memoryEntries.title} LIKE '[financial]%'`,
    ),
    columns: { title: true, content: true },
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
    limit: 500,
  });

  interface FinancialRecord {
    record_type:   string;
    amount_eur:    number;
    contact_name?: string;
    days_overdue?: number;
    probability?:  number;
    status?:       string;
  }

  const records: FinancialRecord[] = facts.flatMap((f) => {
    try { return [JSON.parse(f.content) as FinancialRecord]; } catch { return []; }
  });

  const aging: InvoiceAgingBucket = { current: 0, days30: 0, days60: 0, days90plus: 0 };
  const clientRevenue = new Map<string, number>();
  const atRisk: FinancialPulse["invoicesAtRisk"] = [];
  let outstanding = 0;
  let pipelineMrr: number | null = null;

  for (const rec of records) {
    if (rec.record_type === "pipeline_deal") {
      pipelineMrr = (pipelineMrr ?? 0) + rec.amount_eur * (rec.probability ?? 0.5);
      continue;
    }
    if (rec.record_type !== "invoice") continue;
    if (rec.status === "paid") continue;

    outstanding += rec.amount_eur;
    const days = rec.days_overdue ?? 0;
    if (days <= 0)       aging.current    += rec.amount_eur;
    else if (days <= 30) aging.days30     += rec.amount_eur;
    else if (days <= 60) aging.days60     += rec.amount_eur;
    else {
      aging.days90plus += rec.amount_eur;
      if (rec.contact_name) atRisk.push({ contactName: rec.contact_name, amountEur: rec.amount_eur, daysOverdue: days });
    }
    if (rec.contact_name) clientRevenue.set(rec.contact_name, (clientRevenue.get(rec.contact_name) ?? 0) + rec.amount_eur);
  }

  const top5 = [...clientRevenue.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, revenueEur]) => ({ name, revenueEur }));

  atRisk.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return {
    mrrEquivalent:    pipelineMrr,
    outstandingTotal: outstanding,
    aging,
    top5Clients:      top5,
    cashProjection:   { days30: aging.current - aging.days30 * 0.1, days60: aging.current - aging.days60 * 0.3, days90: aging.current - aging.days90plus * 0.6 },
    invoicesAtRisk:   atRisk,
    hasConnectedSource: true,
    computedAt:       new Date(),
  };
}

export async function financialAlertGenerator(db: Db, companyId: string): Promise<CandidateCard[]> {
  const pulse = await getFinancialPulse(db, companyId);
  if (!pulse.hasConnectedSource) return [];

  const cards: CandidateCard[] = [];
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  if (pulse.invoicesAtRisk.length > 0) {
    const total = pulse.invoicesAtRisk.reduce((s, i) => s + i.amountEur, 0);
    cards.push({ cardType: "anomaly", urgency: 4, title: `${pulse.invoicesAtRisk.length} facture${pulse.invoicesAtRisk.length > 1 ? "s" : ""} en retard critique`, body: `${fmt(total)} en retard de plus de 60 jours.`, insightKey: `financial:overdue:${companyId}`, actionUrl: `/companies/${companyId}/financial-pulse` });
  }
  if (pulse.cashProjection && pulse.cashProjection.days90 < 0) {
    cards.push({ cardType: "anomaly", urgency: 5, title: "Projection de trésorerie négative à 90 jours", body: `La projection à 90 jours est de ${fmt(pulse.cashProjection.days90)}.`, insightKey: `financial:cash:negative:${companyId}`, actionUrl: `/companies/${companyId}/financial-pulse` });
  }

  logger.info({ companyId, cards: cards.length }, "financial-pulse: cards generated");
  return cards;
}

function emptyPulse(): FinancialPulse {
  return { mrrEquivalent: null, outstandingTotal: 0, aging: { current: 0, days30: 0, days60: 0, days90plus: 0 }, top5Clients: [], cashProjection: null, invoicesAtRisk: [], hasConnectedSource: false, computedAt: new Date() };
}
