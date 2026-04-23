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
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { agentQueue, backgroundQueue, systemQueue } from "../queue/queues.js";
// ── Internal auth guard ────────────────────────────────────────────────────────
const internalAuthToken = process.env.INTERNAL_AUTH_TOKEN;
export const internalAuthMiddleware = (req, res, next) => {
    if (!internalAuthToken) {
        // No token configured — block access entirely
        res.status(503).json({ error: "Internal monitoring not configured." });
        return;
    }
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token || token !== internalAuthToken) {
        res.status(401).json({ error: "Unauthorized." });
        return;
    }
    next();
};
// ── Bull Board setup ───────────────────────────────────────────────────────────
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/internal/queues");
createBullBoard({
    queues: [
        new BullMQAdapter(agentQueue),
        new BullMQAdapter(backgroundQueue),
        new BullMQAdapter(systemQueue),
    ],
    serverAdapter,
});
export const bullBoardRouter = serverAdapter.getRouter();
//# sourceMappingURL=monitoring.js.map