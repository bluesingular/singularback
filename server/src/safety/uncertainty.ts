/**
 * server/src/safety/uncertainty.ts
 *
 * AG-13 — Calibrated uncertainty expression.
 *
 * The [[UNCERTAINTY]] block in soul.md instructs agents to annotate claims:
 *   [CONFIRMÉ]  — directly supported by a source in context
 *   [ESTIMÉ]    — logically inferred but not directly supported
 *   [INCERTAIN] — little support in the available context
 *
 * This service:
 *   1. Provides the [[UNCERTAINTY]] soul.md block text (installed at pack install)
 *   2. Parses annotations from agent output into structured AnnotatedClaim objects
 *   3. Strips annotations for clean external display (affected persons never see tags)
 *   4. Formats annotations as visual indicators for the approval card
 */

import pino from "pino";

const logger = pino({ name: "uncertainty" });

// ── Soul.md block ─────────────────────────────────────────────────────────────

export const UNCERTAINTY_SOUL_BLOCK = `
[[UNCERTAINTY]]
Dans toute sortie structurée, annote les affirmations :
- [CONFIRMÉ] : directement soutenu par une source dans le contexte
- [ESTIMÉ] : inféré logiquement mais non directement soutenu
- [INCERTAIN] : peu de support dans le contexte disponible
N'annote pas le texte conversationnel — uniquement les données structurées.
[[/UNCERTAINTY]]
`.trim();

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConfidenceLevel = "CONFIRMÉ" | "ESTIMÉ" | "INCERTAIN";

export interface AnnotatedClaim {
  text:       string;
  confidence: ConfidenceLevel;
}

export interface ParsedOutput {
  claims:      AnnotatedClaim[];
  cleanText:   string;   // annotations stripped — safe for external display
  hasAnnotations: boolean;
}

// ── parseAnnotations ──────────────────────────────────────────────────────────

const ANNOTATION_RE = /\[(CONFIRMÉ|ESTIMÉ|INCERTAIN)\]\s*([^\[\n]+)/g;

/**
 * Parse agent output to extract uncertainty annotations.
 * Returns structured claims and clean text (annotations stripped).
 */
export function parseAnnotations(output: string): ParsedOutput {
  const claims: AnnotatedClaim[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex for global regex
  ANNOTATION_RE.lastIndex = 0;
  while ((match = ANNOTATION_RE.exec(output)) !== null) {
    claims.push({
      confidence: match[1] as ConfidenceLevel,
      text:       match[2].trim(),
    });
  }

  // Strip all annotation tags from the clean version
  const cleanText = output
    .replace(/\[(CONFIRMÉ|ESTIMÉ|INCERTAIN)\]\s*/g, "")
    .trim();

  return { claims, cleanText, hasAnnotations: claims.length > 0 };
}

// ── formatForApprovalCard ─────────────────────────────────────────────────────

/**
 * Format annotated claims as approval card indicator objects.
 * Visual rendering is handled by the frontend; this provides the structured data.
 */
export function formatForApprovalCard(parsed: ParsedOutput): ApprovalCardAnnotation[] {
  return parsed.claims.map((claim) => ({
    text:       claim.text,
    confidence: claim.confidence,
    indicator:  CONFIDENCE_INDICATORS[claim.confidence],
  }));
}

export interface ApprovalCardAnnotation {
  text:       string;
  confidence: ConfidenceLevel;
  indicator:  { colour: string; label: string };
}

const CONFIDENCE_INDICATORS: Record<ConfidenceLevel, { colour: string; label: string }> = {
  CONFIRMÉ:  { colour: "#10B981", label: "Confirmé" },
  ESTIMÉ:    { colour: "#F59E0B", label: "Estimé" },
  INCERTAIN: { colour: "#EF4444", label: "Incertain" },
};

// ── installUncertaintyBlock ───────────────────────────────────────────────────

/**
 * Append the [[UNCERTAINTY]] block to a soul.md string if not already present.
 * Called at pack install time for agents with tier ≥ 2 tasks.
 */
export function installUncertaintyBlock(soulMd: string): string {
  if (soulMd.includes("[[UNCERTAINTY]]")) {
    return soulMd; // already installed
  }
  return `${soulMd}\n\n${UNCERTAINTY_SOUL_BLOCK}`;
}

/**
 * Check if a soul.md string contains the [[UNCERTAINTY]] block.
 */
export function hasUncertaintyBlock(soulMd: string): boolean {
  return soulMd.includes("[[UNCERTAINTY]]");
}
