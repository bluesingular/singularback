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

import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import { sseManager, type SseEvent } from "../realtime/sse.js";
import { logger } from "../middleware/logger.js";

export function sseRoutes(_db: Db) {
  const router = Router();

  /**
   * GET /events/stream
   *
   * Upgrades the connection to SSE.  The client must be an authenticated
   * board member with an active company (enforced by actorMiddleware +
   * companyContextMiddleware upstream).
   *
   * Headers set:
   *   Content-Type:      text/event-stream
   *   Cache-Control:     no-cache
   *   Connection:        keep-alive
   *   X-Accel-Buffering: no   ← prevents nginx from buffering frames
   */
  router.get("/events/stream", (req, res) => {
    if (req.actor.type !== "board") {
      res.status(403).json({ error: "Board access required" });
      return;
    }

    const companyId = (req as any).ctx?.companyId as string | undefined;
    if (!companyId) {
      res.status(403).json({ error: "No active company in context" });
      return;
    }

    assertCompanyAccess(req, companyId);

    // ── Upgrade to SSE ─────────────────────────────────────────────────────
    res.setHeader("Content-Type",      "text/event-stream");
    res.setHeader("Cache-Control",     "no-cache");
    res.setHeader("Connection",        "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const connId = randomUUID();

    const conn = {
      id:          connId,
      companyId,
      lastEventAt: Date.now(),
      write(event: SseEvent) {
        // SSE wire format: "event: <type>\ndata: <json>\n\n"
        try {
          res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
        } catch {
          // response already closed — removeConnection handles cleanup
        }
      },
    };

    sseManager.addConnection(conn);

    // Immediately confirm the connection to the client
    res.write(`event: connected\ndata: ${JSON.stringify({ connId, ts: Date.now() })}\n\n`);

    logger.info({ companyId, connId }, "sse: client connected");

    req.on("close", () => {
      sseManager.removeConnection(companyId, connId);
      logger.info({ companyId, connId }, "sse: client disconnected");
    });
  });

  return router;
}
