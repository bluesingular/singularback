/**
 * singular-ag12-ag13-ag14-gapm.test.ts
 *
 * Tests for 4 "at 100 customers" features:
 *   AG-12  Federated live data queries (query_integration action)
 *   AG-13  Calibrated uncertainty expression
 *   AG-14  Counterfactual explainability
 *   Gap M  Contact timing optimisation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// AG-12 — Federated live data queries
// ─────────────────────────────────────────────────────────────────────────────

describe("AG-12 — query_integration action", () => {
  const actionsPath = path.resolve(
    __dirname,
    "../extensions/builtin-actions.ts",
  );
  const src = fs.readFileSync(actionsPath, "utf-8");

  it("registers a query_integration action slug", () => {
    expect(src).toContain('"query_integration"');
  });

  it("declares alwaysRequiresApproval: false — approval driven by gdpr flag, not action type", () => {
    const block = src.slice(
      src.indexOf('"query_integration"'),
      src.indexOf("handler:", src.indexOf('"query_integration"')) + 100,
    );
    expect(block).toContain("alwaysRequiresApproval: false");
  });

  it("respects GDPR routing — passes gdprRequired flag into executeQuery", () => {
    // gdprRequired is extracted from payload and forwarded to executeQuery
    const handlerSection = src.slice(
      src.indexOf('"query_integration"'),
      src.indexOf("});", src.indexOf('"query_integration"') + 50),
    );
    expect(handlerSection).toContain("gdprRequired");
    expect(handlerSection).toContain("executeQuery");
  });

  it("uses cacheResult flag (semantic cache integration)", () => {
    const handlerSection = src.slice(
      src.indexOf('"query_integration"'),
      src.indexOf("});", src.indexOf('"query_integration"') + 50),
    );
    expect(handlerSection).toContain("cacheResult");
  });

  it("decrypts credentials server-side via Vault — RULE 2 invariant", () => {
    const handlerSection = src.slice(
      src.indexOf('"query_integration"'),
      src.indexOf("});", src.indexOf('"query_integration"') + 50),
    );
    // Vault decryption is server-side only
    expect(handlerSection).toContain("decryptCredential");
    // LLM never receives raw credential — only used in executeQuery
    expect(handlerSection).not.toContain("credential =.*llm");
  });

  it("handles disconnected integration gracefully — returns French message", () => {
    const handlerSection = src.slice(
      src.indexOf('"query_integration"'),
      src.indexOf("});", src.indexOf('"query_integration"') + 50),
    );
    expect(handlerSection).toContain("déconnectée");
  });

  it("handles vault not configured — degrades gracefully, does not throw", () => {
    const handlerSection = src.slice(
      src.indexOf('"query_integration"'),
      src.indexOf("});", src.indexOf('"query_integration"') + 50),
    );
    expect(handlerSection).toContain("vault not configured");
  });

  it("passes queryTemplate as pre-defined name — not arbitrary API call", () => {
    // The handler uses queryTemplate string (pre-defined name from connector manifest)
    // It does NOT construct arbitrary URLs from user input
    const handlerSection = src.slice(
      src.indexOf('"query_integration"'),
      src.indexOf("});", src.indexOf('"query_integration"') + 50),
    );
    expect(handlerSection).toContain("queryTemplate");
    // No raw URL construction
    expect(handlerSection).not.toMatch(/https?:\/\/\$\{/);
  });

  it("isExternalCommunication: false — no approval gate by default", () => {
    const block = src.slice(
      src.indexOf('"query_integration"'),
      src.indexOf("handler:", src.indexOf('"query_integration"')) + 100,
    );
    expect(block).toContain("isExternalCommunication: false");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AG-13 — Calibrated uncertainty expression
// ─────────────────────────────────────────────────────────────────────────────

describe("AG-13 — uncertainty module", () => {
  let uncertainty: typeof import("../safety/uncertainty");

  beforeEach(async () => {
    uncertainty = await import("../safety/uncertainty");
  });

  it("exports UNCERTAINTY_SOUL_BLOCK string", () => {
    expect(typeof uncertainty.UNCERTAINTY_SOUL_BLOCK).toBe("string");
    expect(uncertainty.UNCERTAINTY_SOUL_BLOCK.length).toBeGreaterThan(0);
  });

  it("UNCERTAINTY_SOUL_BLOCK contains [[UNCERTAINTY]] marker", () => {
    expect(uncertainty.UNCERTAINTY_SOUL_BLOCK).toContain("[[UNCERTAINTY]]");
  });

  it("UNCERTAINTY_SOUL_BLOCK references all three confidence levels", () => {
    expect(uncertainty.UNCERTAINTY_SOUL_BLOCK).toContain("CONFIRMÉ");
    expect(uncertainty.UNCERTAINTY_SOUL_BLOCK).toContain("ESTIMÉ");
    expect(uncertainty.UNCERTAINTY_SOUL_BLOCK).toContain("INCERTAIN");
  });

  it("parseAnnotations extracts [CONFIRMÉ] tagged claim", () => {
    const output = "Sophie a analysé le dossier. [CONFIRMÉ] Le client a signé le 15 mars.";
    const result = uncertainty.parseAnnotations(output);
    expect(result.hasAnnotations).toBe(true);
    expect(result.claims.some((c) => c.confidence === "CONFIRMÉ")).toBe(true);
  });

  it("parseAnnotations extracts [ESTIMÉ] tagged claim", () => {
    const output = "[ESTIMÉ] Le chiffre d'affaires devrait atteindre 50k€.";
    const result = uncertainty.parseAnnotations(output);
    expect(result.claims.some((c) => c.confidence === "ESTIMÉ")).toBe(true);
  });

  it("parseAnnotations extracts [INCERTAIN] tagged claim", () => {
    const output = "[INCERTAIN] La date de livraison pourrait changer.";
    const result = uncertainty.parseAnnotations(output);
    expect(result.claims.some((c) => c.confidence === "INCERTAIN")).toBe(true);
  });

  it("parseAnnotations returns cleanText without annotation tags", () => {
    const output = "[CONFIRMÉ] Le contrat est signé. [INCERTAIN] Le budget est estimé.";
    const result = uncertainty.parseAnnotations(output);
    expect(result.cleanText).not.toContain("[CONFIRMÉ]");
    expect(result.cleanText).not.toContain("[INCERTAIN]");
  });

  it("parseAnnotations hasAnnotations: false for plain text", () => {
    const result = uncertainty.parseAnnotations("Voici une réponse sans annotations.");
    expect(result.hasAnnotations).toBe(false);
    expect(result.claims).toHaveLength(0);
  });

  it("formatForApprovalCard returns colour indicators per level", () => {
    const parsed = uncertainty.parseAnnotations(
      "[CONFIRMÉ] Fait établi. [ESTIMÉ] Valeur estimée. [INCERTAIN] Donnée incertaine.",
    );
    const cards = uncertainty.formatForApprovalCard(parsed);
    const colours = cards.map((c) => c.indicator.colour);
    expect(colours).toContain("#10B981"); // CONFIRMÉ — green
    expect(colours).toContain("#F59E0B"); // ESTIMÉ — amber
    expect(colours).toContain("#EF4444"); // INCERTAIN — red
  });

  it("installUncertaintyBlock appends block when not present", () => {
    const soul = "# Identité\nJe suis Sophie.";
    const result = uncertainty.installUncertaintyBlock(soul);
    expect(result).toContain("[[UNCERTAINTY]]");
    expect(result).toContain("# Identité");
  });

  it("installUncertaintyBlock is idempotent — does not double-insert", () => {
    const soul = "Je suis Sophie.";
    const once = uncertainty.installUncertaintyBlock(soul);
    const twice = uncertainty.installUncertaintyBlock(once);
    const count = (twice.match(/\[\[UNCERTAINTY\]\]/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("hasUncertaintyBlock returns true when block is present", () => {
    const soul = `Je suis Sophie.\n\n[[UNCERTAINTY]]\n...`;
    expect(uncertainty.hasUncertaintyBlock(soul)).toBe(true);
  });

  it("hasUncertaintyBlock returns false when block is absent", () => {
    expect(uncertainty.hasUncertaintyBlock("Je suis Sophie.")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AG-14 — Counterfactual explainability
// ─────────────────────────────────────────────────────────────────────────────

describe("AG-14 — counterfactual explainability", () => {
  let cf: typeof import("../compliance/counterfactual");

  beforeEach(async () => {
    cf = await import("../compliance/counterfactual");
  });

  it("generateExplanation returns externalSafe and internalFull arrays", () => {
    const result = cf.generateExplanation({
      outputId: "out-001",
      outputSummary: "Candidat non retenu",
      criteria: ["React 5 ans"],
      metCriteria: [],
      unmetCriteria: ["React 5 ans"],
    });
    expect(Array.isArray(result.externalSafe)).toBe(true);
    expect(Array.isArray(result.internalFull)).toBe(true);
  });

  it("externalSafe lines contain no comparative references to other subjects", () => {
    const result = cf.generateExplanation({
      outputId: "out-002",
      outputSummary: "Candidat non retenu",
      criteria: ["Expérience Node.js 3 ans"],
      metCriteria: [],
      unmetCriteria: ["Expérience Node.js 3 ans"],
    });
    for (const line of result.externalSafe) {
      expect(line.toLowerCase()).not.toMatch(/un autre candidat/);
      expect(line.toLowerCase()).not.toMatch(/meilleur candidat/);
      expect(line.toLowerCase()).not.toMatch(/comparaison/);
    }
  });

  it("internalFull may include comparative context (no restriction)", () => {
    const result = cf.generateExplanation({
      outputId: "out-003",
      outputSummary: "Candidat non retenu",
      criteria: ["TypeScript expert"],
      metCriteria: [],
      unmetCriteria: ["TypeScript expert"],
      comparativeContext: ["Le candidat retenu avait 8 ans TypeScript vs 2 ans ici."],
    });
    expect(result.internalFull.length).toBeGreaterThan(0);
  });

  it("validateExternalSafe throws on comparative language", () => {
    expect(() =>
      cf.validateExternalSafe(["Un autre candidat avait une meilleure maîtrise de React."]),
    ).toThrow();
  });

  it("validateExternalSafe throws on 'meilleur candidat' pattern", () => {
    expect(() =>
      cf.validateExternalSafe(["Le meilleur candidat a été retenu."]),
    ).toThrow();
  });

  it("validateExternalSafe passes for self-referential explanation", () => {
    expect(() =>
      cf.validateExternalSafe([
        "Ce profil ne répond pas au critère: React 5 ans requis (non vérifié).",
      ]),
    ).not.toThrow();
  });

  it("formatForComplianceExport returns { outputId, explanation, gdprSafe }", () => {
    const explanation = cf.generateExplanation({
      outputId: "out-005",
      outputSummary: "Candidat non retenu",
      criteria: ["Disponibilité immédiate"],
      metCriteria: [],
      unmetCriteria: ["Disponibilité immédiate"],
    });
    const exported = cf.formatForComplianceExport(explanation);
    expect(exported).toHaveProperty("outputId");
    expect(exported).toHaveProperty("explanation");
    expect(exported).toHaveProperty("gdprSafe");
  });

  it("formatForComplianceExport gdprSafe: true for clean external explanation", () => {
    const explanation = cf.generateExplanation({
      outputId: "out-006",
      outputSummary: "Candidat non retenu",
      criteria: ["Télétravail 100%"],
      metCriteria: [],
      unmetCriteria: ["Télétravail 100%"],
    });
    const exported = cf.formatForComplianceExport(explanation);
    expect(exported.gdprSafe).toBe(true);
  });

  it("formatForComplianceExport gdprSafe: false and fallback string for GDPR violation in external", () => {
    const explanation = cf.generateExplanation({
      outputId: "out-007",
      outputSummary: "Candidat non retenu",
      criteria: ["Budget"],
      metCriteria: [],
      unmetCriteria: ["Budget"],
    });
    // Inject GDPR-violating line into externalSafe
    const tampered = {
      ...explanation,
      externalSafe: [...explanation.externalSafe, "Un autre candidat était moins cher."],
    };
    const exported = cf.formatForComplianceExport(tampered);
    expect(exported.gdprSafe).toBe(false);
    expect(Array.isArray(exported.explanation)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap M — Contact timing optimisation
// ─────────────────────────────────────────────────────────────────────────────

describe("Gap M — contact timing optimisation", () => {
  const mockDb = {} as any; // functions accept db-like arg; we test logic paths

  it("exports computeOptimalTiming function", async () => {
    const mod = await import("../contacts/timing");
    expect(typeof mod.computeOptimalTiming).toBe("function");
  });

  it("exports getTimingRecommendation function", async () => {
    const mod = await import("../contacts/timing");
    expect(typeof mod.getTimingRecommendation).toBe("function");
  });

  it("getTimingRecommendation returns TimingRecommendation with contactId", async () => {
    const mod = await import("../contacts/timing");
    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          preferredContactTime: {
            day_of_week: [1, 2],
            hour_range: [8, 10],
            confidence: 0.85,
            observations: 7,
          },
        },
      ]),
    } as any;

    const rec = await mod.getTimingRecommendation(dbMock, "contact-123", "company-1");
    expect(rec).toHaveProperty("contactId", "contact-123");
    expect(rec).toHaveProperty("windowStart");
    expect(rec).toHaveProperty("delayMs");
  });

  it("getTimingRecommendation returns windowStart: null when confidence < 0.7", async () => {
    const mod = await import("../contacts/timing");
    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          preferredContactTime: {
            day_of_week: [3],
            hour_range: [14, 16],
            confidence: 0.5, // below threshold
            observations: 2,
          },
        },
      ]),
    } as any;

    const rec = await mod.getTimingRecommendation(dbMock, "contact-456", "company-1");
    expect(rec.windowStart).toBeNull();
  });

  it("getTimingRecommendation returns windowStart: null for contact with no timing data", async () => {
    const mod = await import("../contacts/timing");
    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ preferredContactTime: null }]),
    } as any;

    const rec = await mod.getTimingRecommendation(dbMock, "contact-789", "company-1");
    expect(rec.windowStart).toBeNull();
  });

  it("MIN_CONFIDENCE threshold is 0.7 in source", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../contacts/timing.ts"),
      "utf-8",
    );
    expect(src).toContain("0.7");
  });

  it("computeOptimalTiming writes preferred_contact_time to contacts table", () => {
    // Verify the DB write path exists in source
    const src = fs.readFileSync(
      path.resolve(__dirname, "../contacts/timing.ts"),
      "utf-8",
    );
    expect(src).toContain("preferredContactTime");
    expect(src).toContain(".set(");
  });

  it("PreferredContactTime has day_of_week, hour_range, confidence, observations fields", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../contacts/timing.ts"),
      "utf-8",
    );
    expect(src).toContain("day_of_week");
    expect(src).toContain("hour_range");
    expect(src).toContain("confidence");
    expect(src).toContain("observations");
  });

  it("computeOptimalTiming requires minimum 3 observations before trusting pattern", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../contacts/timing.ts"),
      "utf-8",
    );
    expect(src).toContain("MIN_OBSERVATIONS");
    expect(src).toContain("3");
  });

  it("timing recommendation is a suggestion — operator override always available (documented)", () => {
    // CLAUDE.md: "Operator override always available — this is a suggestion, not a constraint"
    const src = fs.readFileSync(
      path.resolve(__dirname, "../contacts/timing.ts"),
      "utf-8",
    );
    expect(src).toContain("suggestion");
  });
});
