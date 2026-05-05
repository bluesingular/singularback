/**
 * server/src/routes/intelligence.ts
 *
 * Morning intelligence cards API — M11.
 *
 * GET   /companies/:companyId/intelligence-cards          → unread + recent cards
 * PATCH /companies/:companyId/intelligence-cards/:id/read → mark a card read
 */
import type { Db } from "@paperclipai/db";
export declare function intelligenceRoutes(db: Db): import("express-serve-static-core").Router;
//# sourceMappingURL=intelligence.d.ts.map