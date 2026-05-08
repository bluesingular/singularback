/**
 * G14 — A2A protocol routes.
 *
 * Global agent card (no auth):
 *   GET  /.well-known/agent.json              — generic Swwarm platform card
 *
 * Per-company agent card (no auth):
 *   GET  /a2a/:companyId/agent.json           — company-specific card (agents as skills)
 *
 * A2A JSON-RPC endpoint (Bearer auth via public_api_keys):
 *   POST /a2a/:companyId                      — tasks/send, tasks/get, tasks/cancel
 *
 * Content-Type is always application/json.
 * HTTP status is always 200 — A2A errors are returned in the JSON-RPC error field.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { publicApiAuth } from "../middleware/public-api-auth.js";
import { buildAgentCard, handleA2ARequest, A2A_PROTOCOL_VERSION } from "../a2a/server.js";

export function a2aRoutes(db: Db): Router {
  const router = Router({ mergeParams: true });

  // ── Global agent card ──────────────────────────────────────────────────────

  router.get("/.well-known/agent.json", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json({
      name: "Swwarm AI Platform",
      description: "AI agent platform for SMBs — connect your tools and AI team via A2A",
      url: `${baseUrl}/a2a`,
      version: A2A_PROTOCOL_VERSION,
      documentationUrl: "https://docs.swwarm.com/a2a",
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      authentication: { schemes: ["Bearer"] },
      defaultInputModes: ["text/plain", "application/json"],
      defaultOutputModes: ["text/plain", "application/json"],
      skills: [
        {
          id: "delegate-task",
          name: "Delegate task",
          description: "Send a task to the company's AI team",
          tags: ["ai", "task-management"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
      ],
    });
  });

  // ── Per-company agent card ─────────────────────────────────────────────────

  router.get("/a2a/:companyId/agent.json", async (req, res, next) => {
    try {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const card = await buildAgentCard(db, req.params.companyId, baseUrl);
      res.json(card);
    } catch (err) {
      next(err);
    }
  });

  // ── A2A JSON-RPC endpoint ──────────────────────────────────────────────────

  const auth = publicApiAuth(db);

  router.post("/a2a/:companyId", auth, async (req, res) => {
    // publicApiAuth injects req.publicApiCompanyId — verify it matches the URL param
    const companyId = req.publicApiCompanyId!;
    if (companyId !== req.params.companyId) {
      res.status(403).json({ error: "API key does not belong to this company" });
      return;
    }

    const response = await handleA2ARequest(db, companyId, req.body);
    res.json(response);
  });

  return router;
}
