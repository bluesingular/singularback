import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import {
  getConsoleContext,
  approveConsoleCard,
  ConsoleApprovalError,
} from "../console/service.js";
import { agentQueue } from "../queue/queues.js";
import { emit } from "../queue/emit.js";

export function consoleRoutes(db: Db) {
  const router = Router();

  // GET /companies/:companyId/console
  // Returns unread intelligence cards, queue depth, and trust state.
  router.get("/companies/:companyId/console", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    try {
      const context = await getConsoleContext(db, agentQueue as any, companyId);
      res.json(context);
    } catch (err) {
      res.status(500).json({ error: "Failed to load console context" });
    }
  });

  // POST /companies/:companyId/console/approve
  // Approves an intelligence card and triggers task execution (RULE 7).
  router.post("/companies/:companyId/console/approve", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const { cardId, taskId } = req.body as { cardId?: string; taskId?: string };
    if (!cardId || !taskId) {
      res.status(400).json({ error: "cardId and taskId are required" });
      return;
    }

    try {
      await approveConsoleCard(db, emit.taskApproved, {
        cardId,
        taskId,
        companyId,
        userId: req.actor.userId ?? "",
      });
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof ConsoleApprovalError) {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: "Failed to approve card" });
    }
  });

  return router;
}
