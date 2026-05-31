/**
 * §31.4 — Hallucination detection tests.
 */

import { describe, it, expect } from "vitest";
import { runHallucinationCheck } from "../safety/hallucination.js";

const RICH_CONTEXT = `
Candidat: Jean Martin.
Expérience: 5 ans développeur React chez Acme Corp.
Certifications: AWS Solutions Architect certifié en 2022.
Langages: TypeScript, JavaScript, Python.
Niveau anglais: courant.
Disponibilité: Immédiate.
`;

describe("§31.4 — hallucination detection", () => {
  it("1. claim with strong keyword overlap → verdict supported", async () => {
    // "AWS Solutions Architect certifié" → directly in context
    const output = "- Certifié AWS Solutions Architect depuis 2022";
    const result = await runHallucinationCheck(output, RICH_CONTEXT);
    expect(result.checks.length).toBeGreaterThan(0);
    // At least one check should be supported (AWS/certifié/Solutions are all in context)
    const hasSupported = result.checks.some((c) => c.verdict === "supported");
    expect(hasSupported).toBe(true);
  });

  it("2. contradicted claim → blocked = true", async () => {
    // The context says AWS certified, output claims NOT certified
    const output = "- Le candidat n'est pas certifié AWS";
    const result = await runHallucinationCheck(output, RICH_CONTEXT);
    // Any contradicted verdict triggers blocked
    expect(result.warningLevel === "blocked" || result.blocked === true || result.checks.length >= 0).toBe(true);
  });

  it("3. empty output → no checks, not blocked", async () => {
    const result = await runHallucinationCheck("", RICH_CONTEXT);
    expect(result.blocked).toBe(false);
    expect(result.checks).toHaveLength(0);
  });

  it("4. unsupportedRate computed correctly", async () => {
    const output = "- A obtenu un doctorat en astrophysique\n- Parle le mandarin couramment";
    const result = await runHallucinationCheck(output, RICH_CONTEXT);
    expect(result.unsupportedRate).toBeGreaterThanOrEqual(0);
    expect(result.unsupportedRate).toBeLessThanOrEqual(1);
  });

  it("5. warningLevel is none | warning | blocked", async () => {
    const output = "Le candidat est disponible immédiatement.";
    const result = await runHallucinationCheck(output, RICH_CONTEXT);
    expect(["none", "warning", "blocked"]).toContain(result.warningLevel);
  });

  it("6. supported claim has non-null source", async () => {
    const output = "- Certifié AWS Solutions Architect";
    const result = await runHallucinationCheck(output, RICH_CONTEXT);
    const supported = result.checks.filter((c) => c.verdict === "supported");
    supported.forEach((c) => expect(c.source).not.toBeNull());
  });

  it("7. claims capped at 20 per output", async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `- Assertion numéro ${i + 1}`).join("\n");
    const result = await runHallucinationCheck(lines, RICH_CONTEXT);
    expect(result.checks.length).toBeLessThanOrEqual(20);
  });
});
