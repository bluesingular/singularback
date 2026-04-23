/**
 * server/src/routes/monitoring.ts
 *
 * Bull Board — internal queue monitoring UI.
 * Mounted at /internal/queues, protected by a static token check.
 * NEVER expose this route publicly or without authentication.
 *
 * Access: set INTERNAL_AUTH_TOKEN env var, then:
 *   curl -H "Authorization: Bearer <token>" http://localhost:3000/internal/queues
 */
import type { RequestHandler } from "express";
export declare const internalAuthMiddleware: RequestHandler;
export declare const bullBoardRouter: any;
//# sourceMappingURL=monitoring.d.ts.map