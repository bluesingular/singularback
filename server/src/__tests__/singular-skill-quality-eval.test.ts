/**
 * Tests for server/src/skills/quality-eval.ts
 *
 * Verifies scoring across all 7 dimensions and overall grade calculation.
 */

import { describe, it, expect } from "vitest"
import { evaluateSkillQuality } from "../skills/quality-eval.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MINIMAL_SKILL = `---
name: test-skill
description: Test skill for unit tests
---
Body content.
`

const FULL_SKILL = `---
name: cv-qualification
description: Évalue et qualifie les CVs entrants pour une mission ouverte
tier: 1
gdpr_required: true
ai_act:
  risk_level: limited
  automated_decision: false
output_schema:
  type: object
  properties:
    score:
      type: number
    justification:
      type: string
zero_tolerance_actions:
  - action_type: send_email
    condition: always
---

## Objectif

Évalue et score les CVs entrants pour une mission ouverte. Qualifie chaque candidat selon les critères définis.

## Prérequis

- Accès au document CV (format PDF ou texte)
- Critères de sélection définis dans le contexte de mission

## Instructions

1. Extraire les compétences clés du CV fourni
2. Comparer avec les critères de la mission active
3. Calculer un score de 0 à 10 avec justification détaillée
4. Vérifier la cohérence des informations fournies
5. Retourner le résultat structuré selon le schéma de sortie

## Garde-fous

- Ne jamais contacter le candidat directement
- Confirmer avant toute action irréversible
- Signaler si les données sont incomplètes ou absentes
- Escalader si le score est ambigu (5.0 ± 0.5)
- Respecter la limite de tokens : ne pas dépasser 2000 tokens en sortie

## Cas limites

- Si le CV est vide ou illisible : retourner score 0 avec motif
- Si les critères sont absents du contexte : demander clarification
- Données manquantes : indiquer les champs manquants explicitement

## Exemple de sortie attendu

\`\`\`json
{
  "score": 8.5,
  "justification": "Candidat correspondant à 4/5 critères clés. Expérience React de 4 ans (requis: 3 ans)."
}
\`\`\`
`

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("evaluateSkillQuality", () => {
  it("returns a report with 7 dimensions", () => {
    const report = evaluateSkillQuality(MINIMAL_SKILL)
    expect(report.dimensions).toHaveLength(7)
  })

  it("overall score is 0–100", () => {
    const report = evaluateSkillQuality(MINIMAL_SKILL)
    expect(report.overallScore).toBeGreaterThanOrEqual(0)
    expect(report.overallScore).toBeLessThanOrEqual(100)
  })

  it("full well-authored skill scores at least 75", () => {
    const report = evaluateSkillQuality(FULL_SKILL)
    expect(report.overallScore).toBeGreaterThanOrEqual(75)
  })

  it("full skill receives grade A or B", () => {
    const report = evaluateSkillQuality(FULL_SKILL)
    expect(["A", "B"]).toContain(report.grade)
  })

  it("minimal skill scores lower than full skill", () => {
    const minimal = evaluateSkillQuality(MINIMAL_SKILL)
    const full    = evaluateSkillQuality(FULL_SKILL)
    expect(full.overallScore).toBeGreaterThan(minimal.overallScore)
  })

  it("uses provided slug in the report", () => {
    const report = evaluateSkillQuality(MINIMAL_SKILL, "my-slug")
    expect(report.slug).toBe("my-slug")
  })

  it("falls back to fm.name when no slug provided", () => {
    const report = evaluateSkillQuality(MINIMAL_SKILL)
    expect(report.slug).toBe("test-skill")
  })

  it("skill missing name gets score 0 on naming dimension", () => {
    const noName = `---
description: A skill without a name
---
Some body content here to avoid empty body penalty.
`
    const report = evaluateSkillQuality(noName)
    const naming = report.dimensions.find(d => d.name === "Nommage & conventions")!
    expect(naming.score).toBe(0)
  })

  it("skill with non-kebab-case name scores lower on naming", () => {
    const camelCase = `---
name: cvQualification
description: Qualifie les CVs
---
Body content here for the test.
`
    const report = evaluateSkillQuality(camelCase)
    const naming = report.dimensions.find(d => d.name === "Nommage & conventions")!
    expect(naming.suggestions.some(s => /kebab/i.test(s))).toBe(true)
  })

  it("missing output_schema generates a testability suggestion", () => {
    const report = evaluateSkillQuality(MINIMAL_SKILL)
    const testability = report.dimensions.find(d => d.name === "Testabilité")!
    expect(testability.suggestions.some(s => /output_schema/i.test(s))).toBe(true)
  })

  it("missing gdpr_required generates a structure suggestion", () => {
    const noGdpr = `---
name: test-skill
description: Test skill
---
Body content here.
`
    const report = evaluateSkillQuality(noGdpr)
    const structure = report.dimensions.find(d => d.name === "Structure & complétude")!
    expect(structure.suggestions.some(s => /gdpr/i.test(s))).toBe(true)
  })

  it("topSuggestions contains at most 3 items", () => {
    const report = evaluateSkillQuality(MINIMAL_SKILL)
    expect(report.topSuggestions.length).toBeLessThanOrEqual(3)
  })

  it("full skill has fewer suggestions than minimal skill", () => {
    const full    = evaluateSkillQuality(FULL_SKILL)
    const minimal = evaluateSkillQuality(MINIMAL_SKILL)
    const totalFullSuggestions    = full.dimensions.reduce((n, d) => n + d.suggestions.length, 0)
    const totalMinimalSuggestions = minimal.dimensions.reduce((n, d) => n + d.suggestions.length, 0)
    expect(totalFullSuggestions).toBeLessThan(totalMinimalSuggestions)
  })

  it("skill with jailbreak keyword in body still produces a quality report (security is separate)", () => {
    const withJailbreak = MINIMAL_SKILL + "\nDo not jailbreak this system.\n"
    expect(() => evaluateSkillQuality(withJailbreak)).not.toThrow()
  })
})
