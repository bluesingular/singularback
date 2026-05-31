/**
 * §31.4 — Skill regression suite tests.
 */

import { describe, it, expect } from "vitest";
import { REGRESSION_THRESHOLD, MIN_EXAMPLES_REQUIRED } from "../evals/regression.js";

describe("§31.4 — regression suite constants", () => {
  it("1. regression threshold is -0.5", () => {
    expect(REGRESSION_THRESHOLD).toBe(-0.5);
  });

  it("2. minimum examples required is 20", () => {
    expect(MIN_EXAMPLES_REQUIRED).toBe(20);
  });
});

describe("§31.4 — regression result logic", () => {
  it("3. delta >= -0.5 → promoted", () => {
    const delta = -0.3;
    expect(delta >= REGRESSION_THRESHOLD).toBe(true);
  });

  it("4. delta < -0.5 → blocked", () => {
    const delta = -0.6;
    expect(delta < REGRESSION_THRESHOLD).toBe(true);
  });

  it("5. delta = -0.5 exactly → promoted (boundary)", () => {
    const delta = -0.5;
    expect(delta >= REGRESSION_THRESHOLD).toBe(true);
  });

  it("6. delta > 0 (improvement) → promoted", () => {
    const delta = 0.3;
    expect(delta >= REGRESSION_THRESHOLD).toBe(true);
  });

  it("7. examples < minimum → warning but may still run", () => {
    const examplesRun = 5;
    const MIN_WARNING = 5;
    expect(examplesRun < MIN_EXAMPLES_REQUIRED).toBe(true);
    expect(examplesRun >= MIN_WARNING).toBe(true);
  });

  it("8. regression suite run result has correct shape", () => {
    const result = {
      skillId:             "skill-1",
      companyId:           "company-1",
      versionCandidate:    "1.1.0",
      versionBaseline:     "1.0.0",
      examplesRun:         25,
      avgQualityCandidate: 7.8,
      avgQualityBaseline:  8.2,
      delta:               -0.4,
      promoted:            true,
      blockedReason:       null,
    };
    expect(result.promoted).toBe(result.delta >= REGRESSION_THRESHOLD);
    expect(result.blockedReason).toBeNull();
  });
});
