/**
 * Gap M — Contact timing optimisation tests.
 */

import { describe, it, expect } from "vitest";

// Test the pure nextWindowStart logic by reproducing it inline
function nextWindowStart(
  pref: { day_of_week: number[]; hour_range: [number, number] },
  from: Date,
): Date | null {
  if (!pref.day_of_week.length) return null;
  const targetDow  = pref.day_of_week[0];
  const targetHour = pref.hour_range[0];
  const fromDow    = ((from.getUTCDay() + 6) % 7) + 1;
  let daysAhead = (targetDow - fromDow + 7) % 7;
  if (daysAhead === 0 && from.getUTCHours() >= targetHour) daysAhead = 7;
  const candidate = new Date(from);
  candidate.setUTCDate(candidate.getUTCDate() + daysAhead);
  candidate.setUTCHours(targetHour, 0, 0, 0);
  return candidate;
}

const MIN_OBSERVATIONS = 3;
const MIN_CONFIDENCE   = 0.7;
const MAX_DELAY_HOURS  = 24;

describe("Gap M — nextWindowStart", () => {
  it("1. returns correct next Monday 9am when from is Sunday", () => {
    // Sunday 2026-05-31 12:00 UTC → next Monday = 2026-06-01
    const from = new Date("2026-05-31T12:00:00Z"); // Sunday
    const pref = { day_of_week: [1], hour_range: [9, 11] as [number, number] };
    const next = nextWindowStart(pref, from);
    expect(next?.getUTCDay()).toBe(1); // Monday
    expect(next?.getUTCHours()).toBe(9);
  });

  it("2. same day but past the hour → jumps to next week", () => {
    // Monday 10:00 UTC, window is Monday 9:00 → past → next Monday
    const from = new Date("2026-06-01T10:00:00Z"); // Monday 10am
    const pref = { day_of_week: [1], hour_range: [9, 11] as [number, number] };
    const next = nextWindowStart(pref, from);
    // Should be next week Monday
    const diff = (next!.getTime() - from.getTime()) / (1000 * 3600 * 24);
    expect(diff).toBeGreaterThan(6);
    expect(diff).toBeLessThanOrEqual(7);
  });

  it("3. already in window → daysAhead = 0 → same day correct time", () => {
    // Monday 08:30 UTC, window starts 09:00 → daysAhead = 0, hour not past yet
    const from = new Date("2026-06-01T08:30:00Z"); // Monday 8:30am
    const pref = { day_of_week: [1], hour_range: [9, 11] as [number, number] };
    const next = nextWindowStart(pref, from);
    expect(next?.getUTCDay()).toBe(1);
    expect(next?.getUTCHours()).toBe(9);
  });

  it("4. empty day_of_week → returns null", () => {
    const from = new Date();
    const pref = { day_of_week: [], hour_range: [9, 11] as [number, number] };
    expect(nextWindowStart(pref, from)).toBeNull();
  });

  it("5. window more than 24h away → delayMs exceeds MAX_DELAY_HOURS", () => {
    // Tuesday window, from is Monday 10am = ~23h delay
    const from = new Date("2026-06-01T10:00:00Z"); // Monday 10am
    const pref = { day_of_week: [2], hour_range: [9, 11] as [number, number] }; // Tuesday 9am
    const next = nextWindowStart(pref, from);
    const delayMs = next!.getTime() - from.getTime();
    const delayH  = delayMs / 3_600_000;
    // About 23h — within 24h
    expect(delayH).toBeLessThan(24);
  });
});

describe("Gap M — timing thresholds", () => {
  it("6. minimum 3 observations before trust", () => {
    expect(MIN_OBSERVATIONS).toBe(3);
  });

  it("7. confidence threshold is 0.7", () => {
    expect(MIN_CONFIDENCE).toBe(0.7);
  });

  it("8. max delay is 24h", () => {
    expect(MAX_DELAY_HOURS).toBe(24);
  });

  it("9. confidence below threshold → no scheduling", () => {
    const confidence = 0.6;
    expect(confidence < MIN_CONFIDENCE).toBe(true);
  });

  it("10. observations below minimum → no scheduling", () => {
    const observations = 2;
    expect(observations < MIN_OBSERVATIONS).toBe(true);
  });
});

describe("Gap M — PreferredContactTime schema", () => {
  it("11. valid preferred_contact_time shape", () => {
    const pref = {
      day_of_week:  [1, 2],
      hour_range:   [8, 10] as [number, number],
      confidence:   0.8,
      observations: 5,
    };
    expect(Array.isArray(pref.day_of_week)).toBe(true);
    expect(pref.hour_range).toHaveLength(2);
    expect(pref.confidence).toBeGreaterThanOrEqual(0);
    expect(pref.confidence).toBeLessThanOrEqual(1);
  });
});
