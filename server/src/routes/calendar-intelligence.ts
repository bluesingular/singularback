/**
 * server/src/routes/calendar-intelligence.ts
 *
 * §19 — Calendar Intelligence routes.
 *
 * POST /companies/:companyId/calendar/briefing
 *   Generate a pre-meeting briefing for a calendar event.
 *   Called 30 minutes before the event by the scheduler worker.
 */

import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import { generatePreMeetingBriefing, type CalendarEvent } from "../intelligence/calendar.js";

const briefingSchema = z.object({
  event: z.object({
    id:          z.string(),
    title:       z.string(),
    startAt:     z.string().datetime(),
    endAt:       z.string().datetime(),
    attendees:   z.array(z.string()).default([]),
    contactId:   z.string().uuid().optional(),
    contactName: z.string().optional(),
  }),
});

export function calendarIntelligenceRoutes(db: Db): Router {
  const router = Router();

  // POST /companies/:companyId/calendar/briefing
  router.post("/companies/:companyId/calendar/briefing", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      const { event: raw } = briefingSchema.parse(req.body);
      const event: CalendarEvent = {
        ...raw,
        startAt: new Date(raw.startAt),
        endAt:   new Date(raw.endAt),
      };

      const briefing = await generatePreMeetingBriefing(db, companyId, event);
      res.json({ ok: true, data: briefing });
    } catch (err) { next(err); }
  });

  return router;
}
