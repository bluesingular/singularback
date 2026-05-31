/**
 * AG-13 — Calibrated uncertainty expression tests.
 */

import { describe, it, expect } from "vitest";
import {
  parseAnnotations,
  formatForApprovalCard,
  installUncertaintyBlock,
  hasUncertaintyBlock,
  UNCERTAINTY_SOUL_BLOCK,
} from "../safety/uncertainty.js";

describe("AG-13 — parseAnnotations", () => {
  it("1. extracts CONFIRMÉ annotation", () => {
    const output = "[CONFIRMÉ] Budget approuvé le 15 mai.";
    const result = parseAnnotations(output);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].confidence).toBe("CONFIRMÉ");
    expect(result.claims[0].text).toContain("Budget approuvé");
  });

  it("2. extracts ESTIMÉ annotation", () => {
    const output = "[ESTIMÉ] Budget autour de 50k€ basé sur discussions précédentes.";
    const result = parseAnnotations(output);
    expect(result.claims[0].confidence).toBe("ESTIMÉ");
  });

  it("3. extracts INCERTAIN annotation", () => {
    const output = "[INCERTAIN] Date de démarrage non confirmée.";
    const result = parseAnnotations(output);
    expect(result.claims[0].confidence).toBe("INCERTAIN");
  });

  it("4. strips annotations from cleanText", () => {
    const output = "[CONFIRMÉ] Budget approuvé. [ESTIMÉ] Date probable.";
    const result = parseAnnotations(output);
    expect(result.cleanText).not.toContain("[CONFIRMÉ]");
    expect(result.cleanText).not.toContain("[ESTIMÉ]");
    expect(result.cleanText).toContain("Budget approuvé");
  });

  it("5. no annotations → hasAnnotations false, cleanText = original", () => {
    const output = "Résumé sans annotation.";
    const result = parseAnnotations(output);
    expect(result.hasAnnotations).toBe(false);
    expect(result.cleanText).toBe("Résumé sans annotation.");
  });

  it("6. multiple annotations in one output", () => {
    const output = "[CONFIRMÉ] A. [ESTIMÉ] B. [INCERTAIN] C.";
    const result = parseAnnotations(output);
    expect(result.claims).toHaveLength(3);
    expect(result.claims.map((c) => c.confidence)).toEqual(["CONFIRMÉ", "ESTIMÉ", "INCERTAIN"]);
  });
});

describe("AG-13 — formatForApprovalCard", () => {
  it("7. CONFIRMÉ → green indicator", () => {
    const parsed = parseAnnotations("[CONFIRMÉ] Contrat signé.");
    const card   = formatForApprovalCard(parsed);
    expect(card[0].indicator.colour).toBe("#10B981");
    expect(card[0].indicator.label).toBe("Confirmé");
  });

  it("8. ESTIMÉ → amber indicator", () => {
    const parsed = parseAnnotations("[ESTIMÉ] Budget estimé.");
    const card   = formatForApprovalCard(parsed);
    expect(card[0].indicator.colour).toBe("#F59E0B");
    expect(card[0].indicator.label).toBe("Estimé");
  });

  it("9. INCERTAIN → red indicator", () => {
    const parsed = parseAnnotations("[INCERTAIN] Date inconnue.");
    const card   = formatForApprovalCard(parsed);
    expect(card[0].indicator.colour).toBe("#EF4444");
    expect(card[0].indicator.label).toBe("Incertain");
  });
});

describe("AG-13 — soul.md installation", () => {
  it("10. installUncertaintyBlock adds block to empty soul.md", () => {
    const result = installUncertaintyBlock("Tu es Sophie.");
    expect(result).toContain("[[UNCERTAINTY]]");
    expect(result).toContain("Tu es Sophie.");
  });

  it("11. installUncertaintyBlock is idempotent", () => {
    const first  = installUncertaintyBlock("Tu es Sophie.");
    const second = installUncertaintyBlock(first);
    // Block should appear exactly once
    expect(second.split("[[UNCERTAINTY]]").length - 1).toBe(1);
  });

  it("12. hasUncertaintyBlock returns true when block present", () => {
    expect(hasUncertaintyBlock(UNCERTAINTY_SOUL_BLOCK)).toBe(true);
  });

  it("13. hasUncertaintyBlock returns false when block absent", () => {
    expect(hasUncertaintyBlock("Tu es Sophie.")).toBe(false);
  });

  it("14. soul.md block contains three annotation levels", () => {
    expect(UNCERTAINTY_SOUL_BLOCK).toContain("[CONFIRMÉ]");
    expect(UNCERTAINTY_SOUL_BLOCK).toContain("[ESTIMÉ]");
    expect(UNCERTAINTY_SOUL_BLOCK).toContain("[INCERTAIN]");
  });
});
