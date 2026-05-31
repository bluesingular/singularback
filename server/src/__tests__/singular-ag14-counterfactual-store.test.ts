/**
 * AG-14 — Counterfactual explainability store tests.
 */

import { describe, it, expect, vi } from "vitest";
import {
  isHighRiskSkill,
  generateAndStore,
  formatStoredForExport,
  type StoredExplanation,
} from "../compliance/counterfactual-store.js";

describe("AG-14 — isHighRiskSkill", () => {
  it("1. cv_qualification is high-risk", () => {
    expect(isHighRiskSkill("cv_qualification")).toBe(true);
  });

  it("2. qualification-cv (hyphenated) is high-risk", () => {
    expect(isHighRiskSkill("qualification-cv")).toBe(true);
  });

  it("3. candidate_scoring is high-risk", () => {
    expect(isHighRiskSkill("candidate_scoring")).toBe(true);
  });

  it("4. prospect_scoring is high-risk", () => {
    expect(isHighRiskSkill("prospect_scoring")).toBe(true);
  });

  it("5. email drafting is NOT high-risk", () => {
    expect(isHighRiskSkill("client_email")).toBe(false);
  });

  it("6. weekly_report is NOT high-risk", () => {
    expect(isHighRiskSkill("weekly_client_report")).toBe(false);
  });
});

describe("AG-14 — generateAndStore", () => {
  function makeDb(returnRow = [{ id: "explain-1" }]) {
    const stored: any[] = [];
    return {
      db: {
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((v: any) => ({
            returning: vi.fn().mockResolvedValue(returnRow),
          })),
        })),
      } as any,
      stored,
    };
  }

  it("7. returns null for non-high-risk skill", async () => {
    const { db } = makeDb();
    const result = await generateAndStore({
      db,
      taskId:       "task-1",
      companyId:    "company-1",
      skillSlug:    "client_email",
      decision:     "Email envoyé",
      outputSummary: "Email de relance",
      criteria:     ["ton professionnel"],
      metCriteria:  ["ton professionnel"],
      unmetCriteria: [],
    });
    expect(result).toBeNull();
  });

  it("8. stores explanation for high-risk skill", async () => {
    const { db } = makeDb([{ id: "explain-42" }]);
    const result = await generateAndStore({
      db,
      taskId:       "task-1",
      companyId:    "company-1",
      skillSlug:    "cv_qualification",
      decision:     "Candidat non retenu",
      outputSummary: "Qualification effectuée",
      criteria:     ["React 5 ans", "TypeScript"],
      metCriteria:  ["TypeScript"],
      unmetCriteria: ["React 5 ans requis"],
    });
    expect(result).toBe("explain-42");
  });

  it("9. counterfactuals are generated from unmet criteria", async () => {
    const { db } = makeDb([{ id: "explain-3" }]);
    await generateAndStore({
      db,
      taskId:       "task-3",
      companyId:    "company-1",
      skillSlug:    "candidate_scoring",
      decision:     "Score insuffisant",
      outputSummary: "Score: 6/10",
      criteria:     ["Python avancé"],
      metCriteria:  [],
      unmetCriteria: ["Python avancé manquant"],
    });
    // Verify insert was called
    expect(db.insert).toHaveBeenCalled();
  });
});

describe("AG-14 — formatStoredForExport (WC-14)", () => {
  it("10. external_safe lines are included in export", () => {
    const explanation: StoredExplanation = {
      id:             "exp-1",
      taskId:         "task-1",
      decision:       "Non retenu",
      keyFactors:     [],
      counterfactuals: [],
      externalSafe:   ["Ce profil ne répond pas au critère : React 5 ans"],
      internalFull:   ["Ce profil ne répond pas au critère : React 5 ans", "Meilleur profil disponible"],
      generatedAt:    new Date(),
    };
    const result = formatStoredForExport(explanation);
    expect(result.gdprSafe).toBe(true);
    expect(result.explanation).toContain("Ce profil ne répond pas au critère : React 5 ans");
  });

  it("11. internal_full content is NOT in the export", () => {
    const explanation: StoredExplanation = {
      id:             "exp-2",
      taskId:         "task-2",
      decision:       "Non retenu",
      keyFactors:     [],
      counterfactuals: [],
      externalSafe:   ["Critère non satisfait."],
      internalFull:   ["Critère non satisfait.", "Un autre candidat était mieux qualifié"],
      generatedAt:    new Date(),
    };
    const result = formatStoredForExport(explanation);
    // "Un autre candidat" would fail GDPR validation, but it's not in external_safe
    expect(result.explanation).not.toContain("Un autre candidat");
  });
});
