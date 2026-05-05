/**
 * server/src/routes/trust.ts
 *
 * Trust calibration API — M9.
 *
 * GET  /companies/:companyId/trust               → all trust scores + proposals for the company
 * POST /companies/:companyId/trust/proposals/:id/approve  → approve an autonomy upgrade
 * POST /companies/:companyId/trust/proposals/:id/reject   → reject a proposal
 */
import type { Db } from "@paperclipai/db";
export declare function trustRoutes(db: Db): import("express-serve-static-core").Router;
//# sourceMappingURL=trust.d.ts.map