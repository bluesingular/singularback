/**
 * server/src/routes/notifications.ts
 *
 * Gap E — Notification API.
 *
 * GET    /companies/:companyId/notifications              → unread list (badge)
 * GET    /companies/:companyId/notifications/all          → full list (centre)
 * PATCH  /companies/:companyId/notifications/:id/read    → mark read
 * PATCH  /companies/:companyId/notifications/:id/dismiss → dismiss
 * POST   /companies/:companyId/notifications/mark-all-read
 * GET    /companies/:companyId/notification-preferences
 * PUT    /companies/:companyId/notification-preferences
 */

import { Router } from "express";
import { z } from "zod";
import pino from "pino";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import {
  getUnreadNotifications,
  getAllNotifications,
  markNotificationRead,
  dismissNotification,
  markAllRead,
  getNotificationPreferences,
  upsertNotificationPreferences,
} from "../notifications/service.js";

const log = pino({ name: "notification-routes" });

const PrefsSchema = z.object({
  approvalInapp:      z.boolean().optional(),
  approvalEmail:      z.boolean().optional(),
  trustInapp:         z.boolean().optional(),
  trustEmail:         z.boolean().optional(),
  intelligenceInapp:  z.boolean().optional(),
  intelligenceEmail:  z.boolean().optional(),
  errorInapp:         z.boolean().optional(),
  errorEmail:         z.boolean().optional(),
  budgetInapp:        z.boolean().optional(),
  budgetEmail:        z.boolean().optional(),
});

function currentUserId(req: any): string {
  return req.actor?.userId ?? req.auth?.userId ?? "";
}

export function notificationRoutes(db: Db) {
  const router = Router();

  // GET /companies/:companyId/notifications  — unread only (for badge)
  router.get("/companies/:companyId/notifications", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const userId = currentUserId(req);
    const rows = await getUnreadNotifications(db, companyId, userId);
    res.json({ notifications: rows, unreadCount: rows.length });
  });

  // GET /companies/:companyId/notifications/all
  router.get("/companies/:companyId/notifications/all", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const userId = currentUserId(req);
    const rows = await getAllNotifications(db, companyId, userId);
    res.json({ notifications: rows });
  });

  // PATCH /companies/:companyId/notifications/:id/read
  router.patch("/companies/:companyId/notifications/:id/read", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    await markNotificationRead(db, companyId, id);
    res.json({ id });
  });

  // PATCH /companies/:companyId/notifications/:id/dismiss
  router.patch("/companies/:companyId/notifications/:id/dismiss", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    await dismissNotification(db, companyId, id);
    res.json({ id });
  });

  // POST /companies/:companyId/notifications/mark-all-read
  router.post("/companies/:companyId/notifications/mark-all-read", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const userId = currentUserId(req);
    await markAllRead(db, companyId, userId);
    res.json({ ok: true });
  });

  // GET /companies/:companyId/notification-preferences
  router.get("/companies/:companyId/notification-preferences", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const userId = currentUserId(req);
    const prefs = await getNotificationPreferences(db, companyId, userId);
    res.json(prefs);
  });

  // PUT /companies/:companyId/notification-preferences
  router.put("/companies/:companyId/notification-preferences", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const userId = currentUserId(req);
    const patch = PrefsSchema.parse(req.body);
    const prefs = await upsertNotificationPreferences(db, companyId, userId, patch);
    res.json(prefs);
  });

  return router;
}
