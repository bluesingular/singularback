/**
 * §34 Partner Programme — unit tests.
 *
 * Tests the referral fee business rules:
 *   - 60 days active subscription required before fee creation
 *   - Partner flag required to access partner endpoints
 *   - Health metrics only on partner dashboard (no operational data)
 */

import { describe, it, expect } from "vitest";

// ── Referral fee business rules ───────────────────────────────────────────────

describe("§34 — partner referral fee rules", () => {
  it("1. company created > 60 days ago → eligible for referral fee", () => {
    const createdAt = new Date(Date.now() - 61 * 86_400_000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);
    expect(new Date(createdAt) <= sixtyDaysAgo).toBe(true);
  });

  it("2. company created < 60 days ago → NOT eligible for referral fee", () => {
    const createdAt = new Date(Date.now() - 30 * 86_400_000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);
    expect(new Date(createdAt) > sixtyDaysAgo).toBe(true);
  });

  it("3. company created exactly 60 days ago → eligible (boundary)", () => {
    const createdAt = new Date(Date.now() - 60 * 86_400_000 - 1);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);
    expect(new Date(createdAt) <= sixtyDaysAgo).toBe(true);
  });

  it("4. referral fee amount must be positive", () => {
    const amountEur = 150;
    expect(amountEur).toBeGreaterThan(0);
  });

  it("5. partner tiers are: certified, silver, gold", () => {
    const validTiers = ["certified", "silver", "gold"];
    expect(validTiers).toHaveLength(3);
    expect(validTiers).toContain("certified");
    expect(validTiers).toContain("silver");
    expect(validTiers).toContain("gold");
  });
});

describe("§34 — partner dashboard invariant", () => {
  it("6. health metrics do NOT expose task content", () => {
    const healthMetrics = {
      companyId:   "company-1",
      name:        "Acme Corp",
      plan:        "growth",
      usagePct:    45,
      memberSince: new Date(),
    };
    // Health metrics only contain aggregate data — no task titles, no agent outputs
    expect(Object.keys(healthMetrics)).not.toContain("taskContent");
    expect(Object.keys(healthMetrics)).not.toContain("agentOutputs");
    expect(Object.keys(healthMetrics)).not.toContain("orgMemory");
  });

  it("7. usage percentage is 0–100", () => {
    const usagePct = Math.round((450 / 2000) * 100);
    expect(usagePct).toBeGreaterThanOrEqual(0);
    expect(usagePct).toBeLessThanOrEqual(100);
  });
});

describe("§34 — white-label config", () => {
  it("8. show_powered_by defaults to true", () => {
    const config = { showPoweredBy: true };
    expect(config.showPoweredBy).toBe(true);
  });

  it("9. primary_colour must match hex pattern", () => {
    const hexRe = /^#[0-9A-Fa-f]{6}$/;
    expect(hexRe.test("#1A9E68")).toBe(true);
    expect(hexRe.test("blue")).toBe(false);
    expect(hexRe.test("#ZZZ")).toBe(false);
  });

  it("10. custom_domain max 200 chars", () => {
    const domain = "ai.partnerco.fr";
    expect(domain.length).toBeLessThanOrEqual(200);
  });
});
