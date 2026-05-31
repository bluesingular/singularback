/**
 * server/src/contacts/timing.ts
 *
 * Gap M — Contact timing optimisation.
 *
 * Learns optimal outreach times from observed response patterns.
 * Minimum 3 observations before the pattern is trusted.
 * Confidence > 0.7 → writes preferred_contact_time to contacts table.
 *
 * At task execution time: if an optimal window is known AND the gap to next
 * window is < 24h AND we're not already in the window, the task is scheduled
 * as a BullMQ delayed job to fire at the window start.
 *
 * Operator override is always available — timing is a suggestion, not a constraint.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { contacts } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "contact-timing" });

const MIN_OBSERVATIONS   = 3;
const MIN_CONFIDENCE     = 0.7;
const MAX_DELAY_HOURS    = 24;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PreferredContactTime {
  day_of_week:  number[];    // ISO weekday 1=Mon … 7=Sun
  hour_range:   [number, number]; // [startHour, endHour] inclusive
  confidence:   number;      // 0-1
  observations: number;      // total data points
}

export interface TimingRecommendation {
  contactId:   string;
  windowStart: Date | null;  // null = send now
  reason:      string;       // plain French for approval card
  delayMs:     number;       // 0 = send now
}

// ── computeOptimalTiming ──────────────────────────────────────────────────────

/**
 * Weekly job: analyse contact_events for a company and update
 * preferred_contact_time for contacts with enough data.
 */
export async function computeOptimalTiming(
  db:        Db,
  companyId: string,
): Promise<number> {
  // Group contact events by contact, day, and hour
  const rows = await (db as any).execute(sql`
    SELECT
      ce.contact_id,
      EXTRACT(isodow FROM ce.created_at AT TIME ZONE 'UTC') AS dow,
      EXTRACT(hour  FROM ce.created_at AT TIME ZONE 'UTC') AS hour,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ce.event_type ILIKE '%reply%' OR ce.event_type ILIKE '%response%') AS replies
    FROM contact_events ce
    INNER JOIN contacts c ON c.id = ce.contact_id
    WHERE c.company_id = ${companyId}
      AND ce.created_at > NOW() - INTERVAL '90 days'
    GROUP BY ce.contact_id, dow, hour
    HAVING COUNT(*) >= 1
    ORDER BY ce.contact_id, replies DESC
  `);

  const contactMap = new Map<string, Array<{ dow: number; hour: number; replies: number; total: number }>>();
  for (const row of (rows as any).rows ?? rows) {
    const id = String(row.contact_id);
    if (!contactMap.has(id)) contactMap.set(id, []);
    contactMap.get(id)!.push({
      dow:     Number(row.dow),
      hour:    Number(row.hour),
      replies: Number(row.replies),
      total:   Number(row.total),
    });
  }

  let updated = 0;
  for (const [contactId, events] of contactMap) {
    const totalObs = events.reduce((s, e) => s + e.total, 0);
    if (totalObs < MIN_OBSERVATIONS) continue;

    const totalReplies = events.reduce((s, e) => s + e.replies, 0);

    // Find the best window: day + hour with highest reply rate
    const best = events.reduce((acc, e) => {
      const rate = e.total > 0 ? e.replies / e.total : 0;
      const accRate = acc.total > 0 ? acc.replies / acc.total : 0;
      return rate > accRate ? e : acc;
    }, events[0]);

    const confidence = totalReplies > 0 ? (best.replies / Math.max(totalReplies, 1)) : 0;
    if (confidence < MIN_CONFIDENCE) continue;

    const preferred: PreferredContactTime = {
      day_of_week:  [best.dow],
      hour_range:   [best.hour, Math.min(best.hour + 2, 23)],
      confidence,
      observations: totalObs,
    };

    await (db as any)
      .update(contacts)
      .set({ preferredContactTime: JSON.stringify(preferred) })
      .where(eq(contacts.id, contactId));

    updated++;
  }

  logger.info({ companyId, updated }, "contact-timing: preferences updated");
  return updated;
}

// ── getTimingRecommendation ───────────────────────────────────────────────────

/**
 * At task execution time: check if a contact has a preferred window and
 * return a scheduling recommendation.
 *
 * Returns delayMs = 0 if:
 *   - no preference exists
 *   - confidence < 0.7
 *   - next window is > 24h away
 *   - we're already in the optimal window
 */
export async function getTimingRecommendation(
  db:          Db,
  contactId:   string,
  companyId:   string,
  timezone:    string = "UTC",
): Promise<TimingRecommendation> {
  const rows = await (db as any)
    .select({ preferredContactTime: (contacts as any).preferredContactTime })
    .from(contacts)
    .where(and(
      eq(contacts.id, contactId),
      eq(contacts.companyId, companyId),
    ))
    .limit(1);

  const pref = rows[0]?.preferredContactTime as PreferredContactTime | null;

  if (!pref || pref.confidence < MIN_CONFIDENCE) {
    return { contactId, windowStart: null, reason: "Aucune préférence apprise.", delayMs: 0 };
  }

  const now = new Date();
  const windowStart = nextWindowStart(pref, now);
  const delayMs = windowStart ? windowStart.getTime() - now.getTime() : 0;

  if (delayMs <= 0) {
    return { contactId, windowStart: null, reason: "Fenêtre optimale en cours.", delayMs: 0 };
  }

  if (delayMs > MAX_DELAY_HOURS * 3_600_000) {
    return { contactId, windowStart: null, reason: "Fenêtre optimale trop éloignée.", delayMs: 0 };
  }

  const dayNames = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  const dayName  = dayNames[pref.day_of_week[0]] ?? "bientôt";
  const reason   = `Envoi programmé ${dayName} matin (meilleur taux de réponse pour ce contact)`;

  return { contactId, windowStart, reason, delayMs };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function nextWindowStart(pref: PreferredContactTime, from: Date): Date | null {
  if (!pref.day_of_week.length) return null;

  const targetDow  = pref.day_of_week[0];           // ISO 1=Mon
  const targetHour = pref.hour_range[0];
  const fromDow    = ((from.getUTCDay() + 6) % 7) + 1; // convert JS 0=Sun to ISO

  let daysAhead = (targetDow - fromDow + 7) % 7;
  // If today is the right day but we're past the hour, go to next week
  if (daysAhead === 0 && from.getUTCHours() >= targetHour) daysAhead = 7;

  const candidate = new Date(from);
  candidate.setUTCDate(candidate.getUTCDate() + daysAhead);
  candidate.setUTCHours(targetHour, 0, 0, 0);
  return candidate;
}
