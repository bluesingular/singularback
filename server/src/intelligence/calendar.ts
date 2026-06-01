/**
 * server/src/intelligence/calendar.ts
 *
 * §19 — Calendar Intelligence.
 *
 * Calendar events are stored as org_memory entries with title "[calendar] <eventId>".
 * Content is JSON: { title, startAt, endAt, attendees, contactName, lastContactDate, lastTopic }.
 *
 * Pre-meeting briefings are generated on demand (called 30 min before event).
 * Relationship alerts are generated during the morning sweep.
 */

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { memoryEntries, issues } from "@paperclipai/db";
import { callLLM } from "../llm/openrouter.js";
import type { CandidateCard } from "./sweep.js";
import pino from "pino";

const logger = pino({ name: "calendar-intelligence" });

export interface CalendarEvent {
  id:           string;
  title:        string;
  startAt:      Date;
  endAt:        Date;
  attendees:    string[];
  contactId?:   string;
  contactName?: string;
}

export interface PreMeetingBriefing {
  eventId:            string;
  contactName:        string;
  lastContact:        { date: Date; summary: string } | null;
  openItems:          string[];
  relationshipHealth: "good" | "needs_attention" | "at_risk";
  contextNotes:       string[];
  watchFor:           string[];
  briefingMd:         string;
}

export async function generatePreMeetingBriefing(
  db:        Db,
  companyId: string,
  event:     CalendarEvent,
): Promise<PreMeetingBriefing> {
  const contactName = event.contactName ?? event.attendees[0] ?? "Contact inconnu";

  // Last interaction: most recent memory entry mentioning this contact name
  const lastMemory = await db.query.memoryEntries.findFirst({
    where: and(
      eq(memoryEntries.companyId, companyId),
      eq(memoryEntries.archived, false),
      sql`${memoryEntries.content} ILIKE ${"%" + contactName + "%"}`,
    ),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
    columns: { content: true, createdAt: true },
  });

  const lastContact = lastMemory
    ? { date: lastMemory.createdAt, summary: lastMemory.content.slice(0, 200) }
    : null;

  // Open tasks mentioning this contact
  const openTasks = await db.query.issues.findMany({
    where: and(
      eq(issues.companyId, companyId),
      sql`${issues.status} NOT IN ('done','cancelled','archived')`,
      sql`${issues.title} ILIKE ${"%" + contactName + "%"}`,
    ),
    columns: { title: true },
    limit: 5,
  });

  const daysSinceLast = lastContact
    ? Math.floor((Date.now() - lastContact.date.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const relationshipHealth: PreMeetingBriefing["relationshipHealth"] =
    daysSinceLast < 30 ? "good" : daysSinceLast < 90 ? "needs_attention" : "at_risk";

  // Recent context notes
  const contextMemories = await db.query.memoryEntries.findMany({
    where: and(
      eq(memoryEntries.companyId, companyId),
      eq(memoryEntries.archived, false),
      sql`${memoryEntries.content} ILIKE ${"%" + contactName + "%"}`,
    ),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
    limit: 5,
    columns: { content: true },
  });
  const contextNotes = contextMemories.map((m) => m.content.slice(0, 150));

  // "Watch for" via LLM
  let watchFor: string[] = [];
  if (contextNotes.length > 0 || openTasks.length > 0) {
    try {
      const briefingModel = "mistralai/mistral-small-3.2"; // T1 GDPR: contact data
      const res   = await callLLM({
        companyId,
        agentId:      "system",
        taskId:       `briefing-${event.id}`,
        model:        briefingModel,
        gdprRequired: true,
        skillName:    "calendar_briefing",
        messages: [{
          role: "user",
          content: `Réunion avec ${contactName} dans 30 min.\nContexte : ${contextNotes.join(" | ")}\nTâches : ${openTasks.map((t) => t.title).join(", ")}\n\nDonne 2-3 points courts à surveiller (JSON array de strings, max 80 chars chacun).`,
        }],
        maxOutputTokens: 200,
      });
      const raw = res.choices[0]?.message?.content ?? "[]";
      watchFor = JSON.parse(raw.replace(/```[a-z]*\n?/g, "").trim()) as string[];
    } catch { /* non-critical */ }
  }

  const briefingMd = renderBriefing(event, contactName, lastContact, openTasks.map((t) => t.title), relationshipHealth, contextNotes, watchFor, daysSinceLast);

  return { eventId: event.id, contactName, lastContact, openItems: openTasks.map((t) => t.title), relationshipHealth, contextNotes, watchFor, briefingMd };
}

export async function calendarAlertGenerator(db: Db, companyId: string): Promise<CandidateCard[]> {
  const now   = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const upcoming = await db.query.memoryEntries.findMany({
    where: and(
      eq(memoryEntries.companyId, companyId),
      eq(memoryEntries.archived, false),
      sql`${memoryEntries.title} LIKE '[calendar]%'`,
      gte(memoryEntries.createdAt, now),
      lt(memoryEntries.createdAt, in48h),
    ),
    columns: { title: true, content: true },
    limit: 10,
  });

  return upcoming.flatMap((evt): CandidateCard[] => {
    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(evt.content) as Record<string, unknown>; } catch { return []; }
    const name = String(meta.contactName ?? "");
    if (!name) return [];
    const lastDate = meta.lastContactDate ? new Date(String(meta.lastContactDate)) : null;
    const daysAgo  = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
    return [{
      cardType:   "relationship",
      urgency:    3,
      title:      `Réunion avec ${name} dans moins de 48h`,
      body:       daysAgo !== null ? `Dernier contact il y a ${daysAgo} jours.` : `Première rencontre enregistrée avec ${name}.`,
      insightKey: `calendar:meeting:${evt.title}`,
      actionUrl:  `/companies/${companyId}/contacts`,
    }];
  });
}

function renderBriefing(event: CalendarEvent, name: string, last: { date: Date; summary: string } | null, openItems: string[], health: string, notes: string[], watchFor: string[], daysSince: number): string {
  const lines = [
    `## Briefing — ${name}`,
    `**Réunion :** ${event.title} — ${event.startAt.toLocaleString("fr-FR")}`,
    "",
    last ? `**Dernier contact :** il y a ${daysSince} jours\n> ${last.summary}` : "**Dernier contact :** aucun enregistré",
    `\n**Santé relationnelle :** ${health === "good" ? "✅ Bonne" : health === "needs_attention" ? "⚠️ À entretenir" : "🔴 À risque"}`,
  ];
  if (openItems.length > 0) { lines.push("\n**Points ouverts :**"); openItems.forEach((i) => lines.push(`- ${i}`)); }
  if (notes.length > 0) { lines.push("\n**Contexte :**"); notes.slice(0, 3).forEach((n) => lines.push(`- ${n}`)); }
  if (watchFor.length > 0) { lines.push("\n**À surveiller :**"); watchFor.forEach((w) => lines.push(`- ${w}`)); }
  return lines.join("\n");
}
