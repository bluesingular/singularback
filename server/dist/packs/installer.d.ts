/**
 * server/src/packs/installer.ts
 *
 * Pack installation — M12.
 *
 * 7-step atomic installation:
 *   Steps 1–5  run inside a DB transaction (rollback on any failure).
 *   Steps 6–7  run after transaction commits (BullMQ — idempotent).
 *
 *   1. Validate pack manifest                   (pure, no DB)
 *   2. Install agents                           (insert agents rows)
 *   3. Install skills                           (insert company_skills rows)
 *   4. Install quality gates                    (insert qualityGates rows)
 *   5. Upsert company DNA                       (upsert companyDna row)
 *   6. Schedule seed tasks via BullMQ           (delay ≤ 10 min — RULE: fires < 10min)
 *   7. Register activation triggers in BullMQ   (scheduled moments)
 *
 * If step 4 (or any earlier step) throws, the transaction rolls back steps 2–3
 * automatically. Steps 6–7 are never reached.
 *
 * RULE 6: BullMQ jobs are idempotent (jobId deduplication).
 * RULE 10: Seed tasks must be indistinguishable from real work.
 */
import type { Db } from "@paperclipai/db";
import { type InstallPackParams, type InstallPackResult, type PackManifest } from "./types.js";
/** Max delay for seed tasks — 10 minutes. Tasks must fire within this window. */
export declare const SEED_TASK_MAX_DELAY_MS: number;
export declare function validatePackManifest(pack: PackManifest): void;
/**
 * Install a pack into a company account.
 *
 * Steps 1–5 run in a single DB transaction; any failure rolls back all DB writes.
 * Steps 6–7 are BullMQ scheduling and run post-commit; they are idempotent.
 */
export declare function installPack(db: Db, params: InstallPackParams): Promise<InstallPackResult>;
//# sourceMappingURL=installer.d.ts.map