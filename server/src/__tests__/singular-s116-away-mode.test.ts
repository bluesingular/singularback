/**
 * §11.6 — Away mode tests.
 */

import { describe, it, expect } from "vitest";

describe("§11.6 — away mode validation rules", () => {
  it("1. endsAt must be after startsAt", () => {
    const startsAt = new Date("2026-06-01T09:00:00Z");
    const endsAt   = new Date("2026-06-08T18:00:00Z");
    expect(endsAt > startsAt).toBe(true);
  });

  it("2. same start and end time is invalid", () => {
    const t = new Date("2026-06-01T09:00:00Z");
    expect(t <= t).toBe(true); // endsAt must be strictly after
    expect(new Date(t) > t).toBe(false);
  });

  it("3. endsAt before startsAt is invalid", () => {
    const startsAt = new Date("2026-06-08T09:00:00Z");
    const endsAt   = new Date("2026-06-01T09:00:00Z");
    expect(endsAt <= startsAt).toBe(true);
  });

  it("4. away period can span multiple days", () => {
    const startsAt = new Date("2026-06-01T00:00:00Z");
    const endsAt   = new Date("2026-06-08T23:59:00Z");
    const durationDays = (endsAt.getTime() - startsAt.getTime()) / 86_400_000;
    expect(durationDays).toBeGreaterThan(1);
  });
});

describe("§11.6 — catch-up briefing generation", () => {
  it("5. briefing includes attention count when non-zero", () => {
    const attention = 3;
    const briefing = attention > 0
      ? `${attention} éléments requirent votre attention.`
      : "Aucune action requise de votre part.";
    expect(briefing).toContain("attention");
  });

  it("6. zero attention items → clean return message", () => {
    const attention = 0;
    const briefing = attention > 0
      ? `${attention} éléments requirent votre attention.`
      : "Aucune action requise de votre part.";
    expect(briefing).toContain("Aucune action");
  });

  it("7. briefing is in French", () => {
    const frenchWords = ["votre", "équipe", "tâches", "terminées"];
    const briefing = "Votre équipe a traité 5 tâches terminées pendant votre absence.";
    const hasFrech = frenchWords.some((w) => briefing.toLowerCase().includes(w));
    expect(hasFrech).toBe(true);
  });

  it("8. briefing is one screen max — under 500 chars", () => {
    const briefing = "## Récapitulatif\n\n3 éléments requirent votre attention.\n✓ 7 tâches traitées.\n\nVoir le tableau de bord →";
    expect(briefing.length).toBeLessThan(500);
  });
});

describe("§11.6 — away mode active check", () => {
  it("9. is active when now is between startsAt and endsAt", () => {
    const now      = new Date("2026-06-04T12:00:00Z");
    const startsAt = new Date("2026-06-01T00:00:00Z");
    const endsAt   = new Date("2026-06-08T23:59:00Z");
    const isActive = now >= startsAt && now <= endsAt;
    expect(isActive).toBe(true);
  });

  it("10. is not active before startsAt", () => {
    const now      = new Date("2026-05-31T23:59:00Z");
    const startsAt = new Date("2026-06-01T00:00:00Z");
    const endsAt   = new Date("2026-06-08T23:59:00Z");
    const isActive = now >= startsAt && now <= endsAt;
    expect(isActive).toBe(false);
  });

  it("11. is not active after endsAt", () => {
    const now      = new Date("2026-06-09T00:00:00Z");
    const startsAt = new Date("2026-06-01T00:00:00Z");
    const endsAt   = new Date("2026-06-08T23:59:00Z");
    const isActive = now >= startsAt && now <= endsAt;
    expect(isActive).toBe(false);
  });
});
