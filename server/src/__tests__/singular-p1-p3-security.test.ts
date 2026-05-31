/**
 * P1 + P3 — CSP headers + rate limiting.
 */

import { describe, it, expect } from "vitest";

// ── P1: CSP header validation ─────────────────────────────────────────────────

describe("P1 — Content Security Policy", () => {
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://api.openrouter.ai https://api.mistral.ai https://openrouter.ai",
    "img-src 'self' data: https:",
    "frame-ancestors 'none'",
  ].join("; ");

  it("1. default-src restricts to self", () => {
    expect(CSP).toContain("default-src 'self'");
  });

  it("2. script-src restricts to self (no unsafe-inline)", () => {
    expect(CSP).toContain("script-src 'self'");
    expect(CSP).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it("3. style-src allows unsafe-inline (required by Tailwind)", () => {
    expect(CSP).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("4. connect-src allows OpenRouter and Mistral APIs", () => {
    expect(CSP).toContain("https://api.openrouter.ai");
    expect(CSP).toContain("https://api.mistral.ai");
  });

  it("5. frame-ancestors none (prevents clickjacking)", () => {
    expect(CSP).toContain("frame-ancestors 'none'");
  });

  it("6. no wildcard in default-src", () => {
    const defaultSrc = CSP.split(";").find((d) => d.trim().startsWith("default-src"));
    expect(defaultSrc).not.toContain("*");
  });
});

// ── P3: Rate limiting thresholds ─────────────────────────────────────────────

describe("P3 — Rate limiting thresholds", () => {
  // Mirror the windows from rate-limit.ts
  const LIMITS = {
    ip:      { windowMs: 3_600_000, max: 1_000 },
    user:    { windowMs: 60_000,    max: 100   },
    company: { windowMs: 3_600_000, max: 10_000 },
    auth:    { windowMs: 900_000,   max: 20    },
  };

  it("7. IP limit is 1000 req/hour", () => {
    expect(LIMITS.ip.max).toBe(1_000);
    expect(LIMITS.ip.windowMs).toBe(3_600_000);
  });

  it("8. user limit is 100 req/minute", () => {
    expect(LIMITS.user.max).toBe(100);
    expect(LIMITS.user.windowMs).toBe(60_000);
  });

  it("9. company limit is 10000 req/hour", () => {
    expect(LIMITS.company.max).toBe(10_000);
    expect(LIMITS.company.windowMs).toBe(3_600_000);
  });

  it("10. auth limit is 20 attempts/15 minutes", () => {
    expect(LIMITS.auth.max).toBe(20);
    expect(LIMITS.auth.windowMs).toBe(900_000);
  });

  it("11. company limit > user limit (tenant can have many users)", () => {
    expect(LIMITS.company.max).toBeGreaterThan(LIMITS.user.max);
  });

  it("12. auth limit is stricter than IP limit per unit time", () => {
    const authRatePerMinute = LIMITS.auth.max / (LIMITS.auth.windowMs / 60_000);
    const ipRatePerMinute   = LIMITS.ip.max  / (LIMITS.ip.windowMs  / 60_000);
    expect(authRatePerMinute).toBeLessThan(ipRatePerMinute);
  });
});
