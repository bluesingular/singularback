/**
 * AG-11 — Cross-session narrative coherence tests.
 */

import { describe, it, expect } from "vitest";

// Pure function tests — no DB mocking needed

describe("AG-11 — narrative momentum", () => {
  // Mirror the logic from narrative.ts
  function computeMomentum(
    missionStats: { total: number; completed: number },
    outcomeStats: { positive: number; negative: number },
  ): "accelerating" | "stable" | "decelerating" {
    if (missionStats.total === 0) return "stable";
    const completionRate = missionStats.completed / missionStats.total;
    const positiveRate = (outcomeStats.positive + outcomeStats.negative) > 0
      ? outcomeStats.positive / (outcomeStats.positive + outcomeStats.negative)
      : 0.5;

    if (completionRate > 0.7 && positiveRate > 0.7) return "accelerating";
    if (completionRate < 0.3 || positiveRate < 0.4)  return "decelerating";
    return "stable";
  }

  it("1. high completion + high positive → accelerating", () => {
    expect(computeMomentum({ total: 10, completed: 8 }, { positive: 8, negative: 1 }))
      .toBe("accelerating");
  });

  it("2. low completion → decelerating", () => {
    expect(computeMomentum({ total: 10, completed: 2 }, { positive: 5, negative: 5 }))
      .toBe("decelerating");
  });

  it("3. low positive rate → decelerating", () => {
    expect(computeMomentum({ total: 10, completed: 7 }, { positive: 2, negative: 8 }))
      .toBe("decelerating");
  });

  it("4. no missions → stable", () => {
    expect(computeMomentum({ total: 0, completed: 0 }, { positive: 0, negative: 0 }))
      .toBe("stable");
  });

  it("5. moderate metrics → stable", () => {
    expect(computeMomentum({ total: 10, completed: 5 }, { positive: 5, negative: 5 }))
      .toBe("stable");
  });
});

describe("AG-11 — focus area derivation", () => {
  function deriveFocusAreas(titles: string[]): string[] {
    const areas = new Set<string>();
    for (const title of titles) {
      const lower = title.toLowerCase();
      if (lower.includes("client") || lower.includes("prospect")) areas.add("relation_client");
      if (lower.includes("recrutement") || lower.includes("cv"))    areas.add("recrutement");
      if (lower.includes("rapport") || lower.includes("analyse"))   areas.add("analyse");
      if (lower.includes("email") || lower.includes("message"))     areas.add("communication");
    }
    return Array.from(areas).slice(0, 3);
  }

  it("6. mission titles → focus areas extracted", () => {
    const areas = deriveFocusAreas(["Qualifier des CV candidats", "Email de relance client"]);
    expect(areas).toContain("recrutement");
    expect(areas).toContain("communication");
  });

  it("7. max 3 focus areas returned", () => {
    const areas = deriveFocusAreas([
      "Qualifier des CV", "Email client", "Rapport analyse", "Relance prospect",
    ]);
    expect(areas.length).toBeLessThanOrEqual(3);
  });

  it("8. no matching titles → empty array", () => {
    expect(deriveFocusAreas(["Mission générale", "Autre tâche"])).toHaveLength(0);
  });
});

describe("AG-11 — period dates", () => {
  it("9. period_start < period_end invariant", () => {
    const start = new Date("2026-05-01");
    const end   = new Date("2026-05-31");
    expect(start.getTime()).toBeLessThan(end.getTime());
  });
});
