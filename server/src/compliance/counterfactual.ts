/**
 * server/src/compliance/counterfactual.ts
 *
 * Gap L — Explainability-privacy compliance.
 *
 * Resolves AI Act Article 13 (explain decisions) vs GDPR Article 5 (data
 * minimisation) by generating TWO formats of counterfactual explanation:
 *
 *   external_safe  — self-referential only; safe to show affected persons.
 *                    Never references other data subjects.
 *   internal_full  — may include comparative context; operators only.
 *                    NEVER shown to affected persons.
 *
 * Both formats are stored in judge_results.dimensions JSONB.
 * external_safe feeds the AI Act compliance export (WC-14).
 * internal_full is role-gated in the approval card (operators only).
 *
 * GDPR invariant: external_safe reasoning is NEVER comparative.
 *   ✓ "Ce profil ne répond pas au critère : React 5 ans requis (non vérifié)"
 *   ✗ "Un autre candidat avait une meilleure maîtrise" ← GDPR violation
 */

import pino from "pino";

const logger = pino({ name: "counterfactual" });

export interface CounterfactualExplanation {
  outputId:     string;
  externalSafe: string[];  // shown to affected persons — self-referential only
  internalFull: string[];  // operators only — may include comparative context
}

export interface ExplainOpts {
  outputId:      string;
  outputSummary: string;      // what the agent decided/produced
  criteria:      string[];    // the criteria applied (from skill frontmatter)
  metCriteria:   string[];    // criteria the subject met
  unmetCriteria: string[];    // criteria the subject did NOT meet
  /**
   * For operators only — NOT included in external_safe.
   * E.g. "Top candidate had 7 years React vs this candidate's 2 years"
   */
  comparativeContext?: string[];
}

// ── generateExplanation ───────────────────────────────────────────────────────

/**
 * Generate a counterfactual explanation for an agent decision.
 *
 * Does not call an LLM — uses the structured criteria fields from the skill output.
 * This keeps explanations deterministic and auditable (AI Act Article 10(3)).
 */
export function generateExplanation(opts: ExplainOpts): CounterfactualExplanation {
  const { outputId, unmetCriteria, metCriteria, comparativeContext } = opts;

  // external_safe: only reference the subject's own attributes
  const externalSafe: string[] = [];

  if (unmetCriteria.length > 0) {
    for (const criterion of unmetCriteria) {
      externalSafe.push(`Ce profil ne répond pas au critère : ${criterion}`);
    }
  }

  if (metCriteria.length > 0) {
    externalSafe.push(
      `Critères satisfaits : ${metCriteria.slice(0, 3).join(", ")}${metCriteria.length > 3 ? ` (et ${metCriteria.length - 3} autres)` : ""}.`,
    );
  }

  if (externalSafe.length === 0) {
    externalSafe.push("Cette décision a été prise sur la base des critères définis pour ce poste.");
  }

  // internal_full: same as external_safe + comparative context for operators
  const internalFull = [
    ...externalSafe,
    ...(comparativeContext ?? []),
  ];

  logger.debug(
    { outputId, unmetCount: unmetCriteria.length, hasComparative: (comparativeContext?.length ?? 0) > 0 },
    "counterfactual: explanation generated",
  );

  return { outputId, externalSafe, internalFull };
}

// ── validateExternalSafe ──────────────────────────────────────────────────────

/**
 * GDPR validation: ensure external_safe lines contain no comparative references.
 * Called before any external_safe content is sent to an affected person or
 * included in the AI Act compliance export.
 *
 * Throws if a GDPR violation is detected (comparative reference found).
 */
export function validateExternalSafe(lines: string[]): void {
  const FORBIDDEN_PATTERNS = [
    /un autre (candidat|profil|dossier)/i,
    /les autres (candidats|profils)/i,
    /meilleur(e)? (candidat|profil|note|score)/i,
    /par rapport aux autres/i,
    /comparaison/i,
  ];

  for (const line of lines) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        throw new Error(
          `GDPR violation in external_safe explanation: comparative reference detected — "${line}"`,
        );
      }
    }
  }
}

// ── formatForComplianceExport ─────────────────────────────────────────────────

/**
 * WC-14: Format explanation for AI Act compliance export.
 * Returns only external_safe lines, validated for GDPR compliance.
 */
export function formatForComplianceExport(explanation: CounterfactualExplanation): {
  outputId:    string;
  explanation: string[];
  gdprSafe:    boolean;
} {
  try {
    validateExternalSafe(explanation.externalSafe);
    return { outputId: explanation.outputId, explanation: explanation.externalSafe, gdprSafe: true };
  } catch (err) {
    logger.error({ outputId: explanation.outputId, err }, "counterfactual: GDPR violation in external_safe");
    return { outputId: explanation.outputId, explanation: ["Explication non disponible pour des raisons de conformité RGPD."], gdprSafe: false };
  }
}
