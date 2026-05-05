/**
 * server/src/routes/sse.ts
 *
 * GET /events/stream — per-company SSE endpoint.
 *
 * Connects a board operator to their company's real-time event stream.
 * The SseManager singleton handles fan-out, keepalives, and inactivity
 * cleanup; this route only handles HTTP negotiation and connection lifecycle.
 *
 * RULE 8 (company isolation): companyId comes from req.actor (auth
 * middleware), never from query params. A board member can only subscribe
 * to their own active company.
 */
import type { Db } from "@paperclipai/db";
export declare function sseRoutes(_db: Db): import("express-serve-static-core").Router;
//# sourceMappingURL=sse.d.ts.map