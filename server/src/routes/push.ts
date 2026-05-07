/**
 * Gap H — WebPush subscribe / unsubscribe routes.
 *
 * POST   /api/companies/:companyId/push/subscribe
 * DELETE /api/companies/:companyId/push/unsubscribe
 *
 * VAPID keys read from env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 * If keys are not configured the routes still succeed (push silently disabled).
 */

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { pushSubscriptions } from "@paperclipai/db";
import pino from "pino";

const log = pino({ name: "push" });

const subscribeBody = z.object({
  endpoint: z.string().url(),
  p256dh:   z.string().min(1),
  auth:     z.string().min(1),
});

const unsubscribeBody = z.object({
  endpoint: z.string().url(),
});

export function pushRoutes(db: Db): Router {
  const router = Router();

  // POST /api/companies/:companyId/push/subscribe
  router.post("/companies/:companyId/push/subscribe", async (req, res) => {
    const { companyId } = req.params;
    const ctx = (req as any).ctx;
    if (!ctx?.userId) return res.status(401).json({ error: "Unauthorized" });

    const parsed = subscribeBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

    const { endpoint, p256dh, auth } = parsed.data;

    try {
      await (db as any)
        .insert(pushSubscriptions)
        .values({ companyId, userId: ctx.userId, endpoint, p256dh, auth })
        .onConflictDoUpdate({
          target: [pushSubscriptions.endpoint],
          set: { companyId, userId: ctx.userId, p256dh, auth },
        });
      log.info({ companyId, userId: ctx.userId }, "push subscription saved");
      return res.status(200).json({ ok: true });
    } catch (err) {
      log.error({ err }, "push subscribe failed");
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // DELETE /api/companies/:companyId/push/unsubscribe
  router.delete("/companies/:companyId/push/unsubscribe", async (req, res) => {
    const { companyId } = req.params;
    const ctx = (req as any).ctx;
    if (!ctx?.userId) return res.status(401).json({ error: "Unauthorized" });

    const parsed = unsubscribeBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

    const { endpoint } = parsed.data;

    try {
      await (db as any)
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.endpoint, endpoint),
            eq(pushSubscriptions.companyId, companyId),
            eq(pushSubscriptions.userId, ctx.userId),
          ),
        );
      log.info({ companyId, userId: ctx.userId }, "push subscription removed");
      return res.status(200).json({ ok: true });
    } catch (err) {
      log.error({ err }, "push unsubscribe failed");
      return res.status(500).json({ error: "Internal error" });
    }
  });

  return router;
}
