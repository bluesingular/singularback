/**
 * server/src/safety/concurrency.ts
 *
 * C4 — Per-company queue rate limiting.
 *
 * Enforces max concurrent tasks per company based on their plan tier.
 * Called by the BullMQ heartbeat worker before starting task execution.
 *
 * If the company is at its limit, the job is NOT processed — it throws
 * CompanyConcurrencyLimitError so BullMQ backs off and retries later.
 */

import { and, eq, inArray, count } from "drizzle-orm";
import { issues, companies } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "concurrency" });

export class CompanyConcurrencyLimitError extends Error {
  constructor(
    public readonly companyId: string,
    public readonly limit:     number,
    public readonly active:    number,
  ) {
    super(`Company ${companyId} has reached concurrency limit: ${active}/${limit} active tasks`);
    this.name = "CompanyConcurrencyLimitError";
  }
}

/**
 * Throws CompanyConcurrencyLimitError if the company already has
 * max_concurrent_tasks issues in progress.
 *
 * Safe to call at every heartbeat — the check is a single indexed COUNT query.
 */
export async function enforceCompanyConcurrency(
  db:        Db,
  companyId: string,
): Promise<void> {
  // Fetch limit from the company row (set by plan at billing time)
  const [company] = await db
    .select({ maxConcurrentTasks: companies.maxConcurrentTasks })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const limit = company?.maxConcurrentTasks ?? 5;

  // Count tasks currently in_progress for this company
  const [row] = await db
    .select({ active: count() })
    .from(issues)
    .where(
      and(
        eq(issues.companyId, companyId),
        inArray(issues.status, ["in_progress", "in_review"]),
      ),
    );

  const active = row?.active ?? 0;

  if (active >= limit) {
    logger.warn({ companyId, active, limit }, "concurrency: company at limit — delaying job");
    throw new CompanyConcurrencyLimitError(companyId, limit, active);
  }
}
