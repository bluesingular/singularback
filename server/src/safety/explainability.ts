/**
 * server/src/safety/explainability.ts
 *
 * Gap L — Explainability-privacy compliance.
 *
 * AI Act Article 13 (explain) vs GDPR Article 5 (minimisation) resolution.
 *
 * Two explanation formats generated for every automated decision:
 *   external_safe:  self-referential only — safe for affected persons (Art. 13)
 *   internal_full:  may include comparative context — operators only, role-gated
 *
 * The external_safe format NEVER references other data subjects.
 * Example violation: "Un autre candidat avait une meilleure maîtrise" ← GDPR breach
 * Correct:           "Ce profil ne répond pas au critère: React 5 ans requis"
 */

import pino from "pino";

const logger = pino({ name: "explainability" });

export interface CounterfactualExplanation {
  /** AI Act compliance — safe for affected persons. Self-referential only. */
  externalSafe: string[];
  /** Internal use only — may include comparative context. Role-gated. */
  internalFull: string[];
  /** Task/decision identifier for audit trail */
  taskId: string;
  /** Timestamp for AI Act compliance export */
  generatedAt: Date;
}

export interface DecisionFactor {
  criterion:    string;   // e.g. "React 5 ans requis"
  met:          boolean;  // did the subject meet this criterion?
  subjectValue: string;   // what the subject had (e.g. "3 ans React")
  required:     string;   // what was required (e.g. "5 ans React")
}

/**
 * Generate compliant explanations for an automated decision.
 *
 * @param taskId        Task that produced the decision
 * @param factors       Decision factors from quality gate or rule engine
 * @param outcome       'pass' | 'fail' | 'escalate'
 * @param comparativeContext  Optional comparative info (never exposed externally)
 */
export function generateExplanation(
  taskId:             string,
  factors:            DecisionFactor[],
  outcome:            "pass" | "fail" | "escalate",
  comparativeContext?: string,
): CounterfactualExplanation {
  const failedFactors = factors.filter((f) => !f.met);
  const passedFactors = factors.filter((f) => f.met);

  // External safe: reference only the subject's own profile vs criteria
  const externalSafe: string[] = failedFactors.map((f) => {
    if (f.subjectValue && f.required) {
      return `Ce profil ne répond pas au critère : ${f.criterion} (requis : ${f.required}, observé : ${f.subjectValue})`;
    }
    return `Ce profil ne répond pas au critère : ${f.criterion}`;
  });

  if (outcome === "pass" && externalSafe.length === 0) {
    externalSafe.push("Ce profil répond à tous les critères définis.");
  }

  if (outcome === "escalate") {
    externalSafe.push("Ce profil nécessite une évaluation humaine complémentaire.");
  }

  // Internal full: may include comparative context — NEVER exposed externally
  const internalFull: string[] = [
    ...externalSafe,
    ...(comparativeContext ? [`[Contexte interne]: ${comparativeContext}`] : []),
    ...passedFactors.map((f) => `✓ ${f.criterion}: ${f.subjectValue}`),
  ];

  logger.info(
    { taskId, outcome, failedCount: failedFactors.length },
    "explainability: explanation generated",
  );

  return {
    externalSafe,
    internalFull,
    taskId,
    generatedAt: new Date(),
  };
}

/**
 * Format an explanation for the AI Act compliance export (WC-14).
 * Returns only external_safe — never leaks internal comparative context.
 */
export function formatForComplianceExport(exp: CounterfactualExplanation): string {
  return [
    `Décision automatisée — ${exp.generatedAt.toISOString()}`,
    `Tâche : ${exp.taskId}`,
    "",
    ...exp.externalSafe,
  ].join("\n");
}
