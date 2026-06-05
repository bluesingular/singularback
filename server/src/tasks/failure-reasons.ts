/**
 * server/src/tasks/failure-reasons.ts
 *
 * C6 — LLM response failure states.
 *
 * Maps runtime errors from the executor pipeline to the named failure_reason
 * values stored on the issues table. Every failure type must:
 *   1. Map to exactly one failure reason string
 *   2. Have a plain-French operator notification (see EMOTIONAL_LAYER.md)
 *   3. NEVER surface a technical error message to the operator
 *
 * Callers (heartbeat worker, batch item worker, approval worker) catch errors
 * from executeSkillTask() and call classifyFailure() to get the reason code
 * before persisting it to issues.failureReason.
 */

import type { TaskCancelledException } from "./checkpoints.js";

// ── Failure reason values (must match issues.failureReason CHECK constraint) ──

export type TaskFailureReason =
  | "failed_schema_validation"   // output didn't match declared schema after 3 attempts
  | "failed_quality_gate"        // quality gate blocked and 2 corrections failed
  | "failed_llm_unavailable"     // model API unreachable after retries
  | "failed_tool_error"          // external tool (Gmail, etc.) failed
  | "failed_budget_exceeded"     // monthly token/task limit hit mid-execution
  | "failed_permanent"           // unrecoverable — requires human intervention
  | "failed_cancelled"           // operator requested cancellation (not really a failure)

// ── French operator messages (subset — full list in EMOTIONAL_LAYER.md) ───────

export const FAILURE_MESSAGES: Record<TaskFailureReason, string> = {
  failed_schema_validation: "La sortie générée n'est pas dans le format attendu. Sophie va réessayer.",
  failed_quality_gate:      "Cette tâche n'a pas passé les contrôles qualité. Votre validation est requise.",
  failed_llm_unavailable:   "Le service IA est temporairement indisponible. La tâche sera relancée automatiquement.",
  failed_tool_error:        "Un outil externe a rencontré une erreur. Vérifiez vos intégrations.",
  failed_budget_exceeded:   "Limite mensuelle atteinte — upgrader pour continuer.",
  failed_permanent:         "Cette tâche nécessite une intervention humaine.",
  failed_cancelled:         "La tâche a été annulée par l'opérateur.",
};

// ── Error classification ──────────────────────────────────────────────────────

/**
 * Map any caught error to a named failure reason.
 * Import the typed error classes from their respective modules and match here.
 */
export function classifyFailure(err: unknown): TaskFailureReason {
  if (err instanceof Error) {
    const name = err.name;
    const msg  = err.message;

    // C3: cancellation is not really a failure
    if (name === "TaskCancelledException") return "failed_cancelled";

    // C4: concurrency limit — transient, will retry
    if (name === "CompanyConcurrencyLimitError") return "failed_permanent";

    // Budget errors
    if (name === "TokenBudgetExceededError" || msg.includes("budget") || msg.includes("limit")) {
      return "failed_budget_exceeded";
    }

    // LLM unavailable
    if (
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("model API") ||
      msg.includes("unavailable") ||
      msg.includes("timeout")
    ) {
      return "failed_llm_unavailable";
    }

    // Quality gate / judge failures
    if (msg.includes("quality gate") || msg.includes("judge") || msg.includes("recycle")) {
      return "failed_quality_gate";
    }

    // Schema validation
    if (msg.includes("schema") || msg.includes("validation") || msg.includes("JSON")) {
      return "failed_schema_validation";
    }

    // Guardrail / collision / injection block → permanent
    if (msg.includes("Guardrail") || msg.includes("collision") || msg.includes("injection")) {
      return "failed_permanent";
    }

    // External tool errors (Gmail, integrations)
    if (
      msg.includes("Gmail") ||
      msg.includes("SMTP") ||
      msg.includes("WhatsApp") ||
      msg.includes("integration") ||
      msg.includes("tool error")
    ) {
      return "failed_tool_error";
    }
  }

  // Default: unclassified → requires human review
  return "failed_permanent";
}
