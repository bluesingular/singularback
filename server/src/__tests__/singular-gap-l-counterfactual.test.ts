/**
 * Gap L — Explainability-privacy compliance tests.
 *
 * Verifies AI Act Article 13 + GDPR Article 5 resolution:
 *   - external_safe contains no comparative references
 *   - internal_full can contain comparative context
 *   - validateExternalSafe throws on GDPR violations
 */

import { describe, it, expect } from "vitest";
import {
  generateExplanation,
  validateExternalSafe,
  formatForComplianceExport,
} from "../compliance/counterfactual.js";

describe("Gap L — generateExplanation", () => {
  it("1. unmet criteria appear in external_safe as self-referential statements", () => {
    const result = generateExplanation({
      outputId:       "out-1",
      outputSummary:  "Candidat non retenu",
      criteria:       ["React 5 ans", "TypeScript"],
      metCriteria:    ["TypeScript"],
      unmetCriteria:  ["React 5 ans requis (non vérifié)"],
    });

    expect(result.externalSafe).toHaveLength(2); // 1 unmet + 1 met summary
    expect(result.externalSafe[0]).toContain("React 5 ans requis");
    expect(result.externalSafe[0]).toContain("Ce profil ne répond pas");
  });

  it("2. external_safe contains NO comparative references", () => {
    const result = generateExplanation({
      outputId:          "out-2",
      outputSummary:     "Candidat non retenu",
      criteria:          ["React", "Python"],
      metCriteria:       [],
      unmetCriteria:     ["React requis"],
      comparativeContext: ["Un autre candidat avait 7 ans d'expérience React"],
    });

    // external_safe should NOT contain comparative context
    for (const line of result.externalSafe) {
      expect(line).not.toContain("Un autre candidat");
    }
  });

  it("3. internal_full contains comparative context for operators", () => {
    const result = generateExplanation({
      outputId:          "out-3",
      outputSummary:     "Candidat non retenu",
      criteria:          ["React"],
      metCriteria:       [],
      unmetCriteria:     ["React requis"],
      comparativeContext: ["Meilleure adéquation disponible dans le pool"],
    });

    expect(result.internalFull.join(" ")).toContain("Meilleure adéquation");
  });

  it("4. external_safe === subset of internal_full (external_safe is always safe)", () => {
    const result = generateExplanation({
      outputId:          "out-4",
      outputSummary:     "Non retenu",
      criteria:          ["Python"],
      metCriteria:       [],
      unmetCriteria:     ["Python requis"],
      comparativeContext: ["Comparaison avec les autres dossiers"],
    });

    // All external_safe lines appear in internal_full
    for (const line of result.externalSafe) {
      expect(result.internalFull).toContain(line);
    }
  });

  it("5. no unmet criteria → fallback explanation", () => {
    const result = generateExplanation({
      outputId:      "out-5",
      outputSummary: "Décision prise",
      criteria:      ["Critère A"],
      metCriteria:   ["Critère A"],
      unmetCriteria: [],
    });

    expect(result.externalSafe[result.externalSafe.length - 1].toLowerCase()).toContain("critères satisfaits");
  });
});

describe("Gap L — validateExternalSafe", () => {
  it("6. self-referential lines pass validation", () => {
    expect(() => validateExternalSafe([
      "Ce profil ne répond pas au critère : React 5 ans requis",
      "Critères satisfaits : TypeScript, Node.js.",
    ])).not.toThrow();
  });

  it("7. comparative reference throws GDPR violation", () => {
    expect(() => validateExternalSafe([
      "Un autre candidat avait une meilleure maîtrise de React",
    ])).toThrow("GDPR violation");
  });

  it("8. 'les autres candidats' pattern throws", () => {
    expect(() => validateExternalSafe([
      "Les autres candidats avaient plus d'expérience",
    ])).toThrow("GDPR violation");
  });

  it("9. 'meilleur candidat' pattern throws", () => {
    expect(() => validateExternalSafe([
      "Un meilleur candidat a été sélectionné",
    ])).toThrow("GDPR violation");
  });

  it("10. 'comparaison' pattern throws", () => {
    expect(() => validateExternalSafe([
      "Après comparaison avec d'autres dossiers",
    ])).toThrow("GDPR violation");
  });
});

describe("Gap L — formatForComplianceExport", () => {
  it("11. valid explanation → gdprSafe: true", () => {
    const result = formatForComplianceExport({
      outputId: "out-export",
      externalSafe: ["Ce profil ne répond pas au critère : Python"],
      internalFull: ["Ce profil ne répond pas au critère : Python", "Comparaison interne"],
    });

    expect(result.gdprSafe).toBe(true);
    expect(result.explanation).toContain("Ce profil ne répond pas au critère : Python");
    expect(result.explanation).not.toContain("Comparaison interne");
  });

  it("12. invalid explanation → gdprSafe: false, fallback message returned", () => {
    const result = formatForComplianceExport({
      outputId: "out-invalid",
      externalSafe: ["Un autre candidat avait de meilleures compétences"],
      internalFull: ["Un autre candidat avait de meilleures compétences"],
    });

    expect(result.gdprSafe).toBe(false);
    expect(result.explanation[0]).toContain("non disponible");
  });
});
