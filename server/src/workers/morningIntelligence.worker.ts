/**
 * server/src/workers/morningIntelligence.worker.ts
 *
 * Processes "intelligence.sweep" jobs from the system queue.
 *
 * Scheduled as a BullMQ repeatable job at 8am UTC daily (registered in
 * scheduleIntelligenceSweep()). When the job fires, it runs
 * generateIntelligenceCards() for every active company using the five
 * real generators defined in generators.ts.
 *
 * INVARIANT: MAX_CARDS_PER_DAY (3) is enforced inside generateIntelligenceCards().
 * RULE 6: idempotent — re-running for the same company on the same day produces
 *          at most 0 new cards (all insightKeys are on 14-day cooldown).
 */

import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import pino from "pino";
import { companies } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { redisConnectionBlocking } from "../queue/redis.js";
import { systemQueue } from "../queue/queues.js";
import {
  generateIntelligenceCards,
  trustProposalGenerator,
  trustAnomalyGenerator,
  goalRiskGenerator,
  relationshipGapGenerator,
  budgetAlertGenerator,
} from "../intelligence/sweep.js";
import { refreshBaselines, detectAnomalies } from "../monitoring/behavioral.js";

const logger = pino({ name: "morning-intelligence-worker" });

const DEFAULT_GENERATORS = [
  trustProposalGenerator,
  trustAnomalyGenerator,
  goalRiskGenerator,
  relationshipGapGenerator,
  budgetAlertGenerator,
];

// ── Worker ────────────────────────────────────────────────────────────────────

export function initMorningIntelligenceWorker(db: Db) {
  const worker = new Worker(
    "system",
    async (job: Job) => {
      if (job.name !== "intelligence.sweep") return;

      // Fetch all active companies
      const activeCompanies = await db
        .select({ id: companies.id, name: companies.name })
        .from(companies);

      logger.info({ count: activeCompanies.length }, "morning-intelligence: starting sweep");

      let totalInserted = 0;
      for (const company of activeCompanies) {
        try {
          const inserted = await generateIntelligenceCards(
            db,
            company.id,
            DEFAULT_GENERATORS,
          );
          totalInserted += inserted;

          // AG-10: refresh behavioral baselines + detect anomalies (admin-only surface)
          await refreshBaselines(db, company.id).catch((err) =>
            logger.warn({ companyId: company.id, err }, "morning-intelligence: baseline refresh failed"),
          );
          await detectAnomalies(db, company.id).catch((err) =>
            logger.warn({ companyId: company.id, err }, "morning-intelligence: anomaly detection failed"),
          );

          logger.info(
            { companyId: company.id, inserted },
            "morning-intelligence: company swept",
          );
        } catch (err) {
          // One company failing must not block the others
          logger.error(
            { companyId: company.id, err },
            "morning-intelligence: company sweep failed",
          );
        }
      }

      logger.info(
        { companies: activeCompanies.length, totalInserted },
        "morning-intelligence: sweep complete",
      );
    },
    { connection: redisConnectionBlocking, concurrency: 1 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "morning-intelligence: job failed");
  });

  return worker;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Register the daily 8am UTC sweep as a BullMQ repeatable job.
 * Safe to call multiple times — BullMQ deduplicates by jobId.
 */
export async function scheduleIntelligenceSweep() {
  await systemQueue.add(
    "intelligence.sweep",
    {},
    {
      repeat: { pattern: "0 8 * * *" }, // 08:00 UTC every day
      jobId: "intelligence-sweep-daily",
    },
  );
  logger.info("morning-intelligence: daily sweep scheduled at 08:00 UTC");
}
