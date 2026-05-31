import { Router } from "express";
import { eq, and, count, inArray, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { authUsers, issues, intelligenceCards } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import {
  getConsoleContext,
  approveConsoleCard,
  ConsoleApprovalError,
} from "../console/service.js";
import { agentQueue } from "../queue/queues.js";
import { emit } from "../queue/emit.js";
import { wasSessionGap } from "../middleware/session-activity.js";

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

  // ── Gap K: Session gap briefing ──────────────────────────────────────────
  // GET /companies/:companyId/session-gap-briefing
  // Fires when operator opens app after ≥6h absence. Returns one-screen briefing.
  // Client calls this on app load; shows overlay if gap_hours > 0.

  router.get("/companies/:companyId/session-gap-briefing", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const userId = req.actor?.userId;
    if (!userId) { res.json({ gapHours: 0 }); return; }

    const [user] = await db
      .select({ lastActiveAt: (authUsers as any).lastActiveAt })
      .from(authUsers)
      .where(eq(authUsers.id, userId))
      .limit(1);

    const lastActiveAt = user?.lastActiveAt as Date | null;
    const isGap = wasSessionGap(lastActiveAt);

    if (!isGap) { res.json({ gapHours: 0 }); return; }

    const gapMs    = lastActiveAt ? Date.now() - lastActiveAt.getTime() : 0;
    const gapHours = Math.round(gapMs / 3_600_000);

    // Count tasks completed + pending since last active
    const since = lastActiveAt ?? new Date(Date.now() - 24 * 3_600_000);

    const [completedRow] = await db
      .select({ n: count() })
      .from(issues)
      .where(and(eq(issues.companyId, companyId), eq(issues.status, "done")));

    const [pendingRow] = await db
      .select({ n: count() })
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          inArray(issues.status, ["in_review", "awaiting_clarification", "partial_complete"]),
        ),
      );

    // Up to 3 notable events from intelligence cards
    const recentCards = await db
      .select({ title: intelligenceCards.title })
      .from(intelligenceCards)
      .where(and(eq(intelligenceCards.companyId, companyId), eq(intelligenceCards.status, "unread")))
      .orderBy(desc(intelligenceCards.urgency))
      .limit(3);

    res.json({
      gapHours,
      tasksCompleted: completedRow?.n ?? 0,
      tasksPending:   pendingRow?.n ?? 0,
      notableEvents:  recentCards.map((c) => c.title),
    });
  });

  return router;
}
