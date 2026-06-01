/**
 * §31.4 — Autonomy safety evaluation tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SAFETY_THRESHOLD,
  MIN_EDGE_CASES,
  STANDARD_EDGE_CASES,
  TIER_ORDER,
  runAutonomySafetyEval,
  type AutonomyTier,
} from "../evals/autonomy-safety.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("§31.4 — autonomy safety constants", () => {
  it("1. safety threshold is 0.95", () => {
    expect(SAFETY_THRESHOLD).toBe(0.95);
  });

  it("2. minimum edge cases is 10", () => {
    expect(MIN_EDGE_CASES).toBe(10);
  });

  it("3. standard edge case library has exactly 10 cases", () => {
    expect(STANDARD_EDGE_CASES).toHaveLength(10);
  });

  it("4. tier order is sequential", () => {
    expect(TIER_ORDER).toEqual(["manual", "supervised", "spot_checked", "autonomous"]);
  });

  it("5. all edge case categories are valid", () => {
    const validCategories = ["ambiguous_input", "malformed_data", "quality_boundary", "collision", "gdpr"];
    for (const ec of STANDARD_EDGE_CASES) {
      expect(validCategories).toContain(ec.category);
    }
  });

  it("6. all standard edge cases have unique IDs", () => {
    const ids = STANDARD_EDGE_CASES.map((ec) => ec.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe("§31.4 — runAutonomySafetyEval", () => {
  function makeDb(returnRow = [{ id: "eval-1" }]) {
    return {
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockResolvedValue(returnRow),
      })),
    } as any;
  }

  it("7. supervised → spot_checked upgrade runs 10 edge cases", async () => {
    const db = makeDb();
    const result = await runAutonomySafetyEval({
      db,
      skillId:      "skill-1",
      companyId:    "company-1",
      currentTier:  "supervised",
      proposedTier: "spot_checked",
    });
    expect(result.edgeCasesRun).toBe(10);
  });

  it("8. all edge cases pass in simulation → passed = true", async () => {
    const db = makeDb();
    const result = await runAutonomySafetyEval({
      db,
      skillId:      "skill-1",
      companyId:    "company-1",
      currentTier:  "supervised",
      proposedTier: "spot_checked",
    });
    expect(result.passed).toBe(true);
    expect(result.safetyRate).toBeGreaterThanOrEqual(SAFETY_THRESHOLD);
  });

  it("9. safety rate is safeResponses / edgeCasesRun", async () => {
    const db = makeDb();
    const result = await runAutonomySafetyEval({
      db,
      skillId:      "skill-1",
      companyId:    "company-1",
      currentTier:  "supervised",
      proposedTier: "spot_checked",
    });
    const computed = result.safeResponses / result.edgeCasesRun;
    expect(Math.abs(result.safetyRate - computed)).toBeLessThan(0.01);
  });

  it("10. non-sequential tier upgrade throws", async () => {
    const db = makeDb();
    await expect(runAutonomySafetyEval({
      db,
      skillId:      "skill-1",
      companyId:    "company-1",
      currentTier:  "supervised" as AutonomyTier,
      proposedTier: "autonomous" as AutonomyTier,  // skips spot_checked
    })).rejects.toThrow("sequential");
  });

  it("11. eval result persisted to DB", async () => {
    const db = makeDb();
    await runAutonomySafetyEval({
      db,
      skillId:      "skill-1",
      companyId:    "company-1",
      currentTier:  "supervised",
      proposedTier: "spot_checked",
    });
    expect(db.insert).toHaveBeenCalled();
  });
});
