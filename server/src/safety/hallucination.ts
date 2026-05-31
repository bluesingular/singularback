/**
 * server/src/safety/hallucination.ts
 *
 * §31.4 — Hallucination detection.
 *
 * Domain-specific consistency checking: verifies that factual claims in an
 * agent output are supported by the context (Company DNA + org memory) that
 * was assembled for the task.
 *
 * NOT model-level hallucination detection — this catches domain hallucinations:
 *   e.g. Sophie states a candidate has an AWS cert, but the CV in context
 *        doesn't mention it → verdict: 'contradicted' → block output
 *
 * Run AFTER quality gates, BEFORE approval notification (§31.4 sequence).
 *
 * Verdict rules:
 *   'supported'    — claim is directly corroborated by context text
 *   'unsupported'  — claim is not in context but not contradicted either
 *   'contradicted' — context explicitly contradicts the claim
 *
 * Policy:
 *   'contradicted' → block output, route to damage control
 *   unsupported > UNSUPPORTED_THRESHOLD → surface warning in approval card
 */

import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { hallucinationChecks } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "hallucination" });

const UNSUPPORTED_THRESHOLD = 0.4; // >40% unsupported claims = warning

// ── Types ─────────────────────────────────────────────────────────────────────

export type HallucinationVerdict = "supported" | "unsupported" | "contradicted";

export interface HallucinationCheck {
  outputId:   string;
  claim:      string;
  source:     string | null;
  verdict:    HallucinationVerdict;
  confidence: number;
}

export interface HallucinationResult {
  checks:          HallucinationCheck[];
  blocked:         boolean;   // true if any verdict === 'contradicted'
  warningLevel:    "none" | "warning" | "blocked";
  unsupportedRate: number;    // 0-1
}

// ── runHallucinationCheck ─────────────────────────────────────────────────────

/**
 * Extract factual claims from an output and verify each against the context.
 *
 * For production: use a T0/T1_FR LLM call to extract claims and verify.
 * Current implementation: rule-based extraction for testability and speed.
 * The LLM-backed version follows the same interface.
 */
export async function runHallucinationCheck(
  output:  string,
  context: string,
): Promise<HallucinationResult> {
  const claims = extractClaims(output);
  const checks: HallucinationCheck[] = [];

  for (const claim of claims) {
    const { verdict, source, confidence } = verifyClaim(claim, context);
    checks.push({ outputId: "pending", claim, source, verdict, confidence });
  }

  const contradicted    = checks.filter((c) => c.verdict === "contradicted");
  const unsupported     = checks.filter((c) => c.verdict === "unsupported");
  const unsupportedRate = checks.length > 0 ? unsupported.length / checks.length : 0;
  const blocked         = contradicted.length > 0;

  let warningLevel: HallucinationResult["warningLevel"] = "none";
  if (blocked) warningLevel = "blocked";
  else if (unsupportedRate > UNSUPPORTED_THRESHOLD) warningLevel = "warning";

  logger.info(
    {
      claims: checks.length,
      contradicted: contradicted.length,
      unsupported: unsupported.length,
      blocked,
    },
    "hallucination: check complete",
  );

  return { checks, blocked, warningLevel, unsupportedRate };
}

// ── persistChecks ─────────────────────────────────────────────────────────────

export async function persistHallucinationChecks(
  db:        Db,
  taskId:    string,
  companyId: string,
  outputId:  string,
  result:    HallucinationResult,
): Promise<void> {
  if (result.checks.length === 0) return;

  await (db as any).insert(hallucinationChecks).values(
    result.checks.map((c) => ({
      taskId,
      companyId,
      outputId,
      claim:      c.claim,
      source:     c.source,
      verdict:    c.verdict,
      confidence: String(c.confidence.toFixed(3)),
      blocked:    c.verdict === "contradicted",
    })),
  );
}

// ── extractClaims ─────────────────────────────────────────────────────────────

/**
 * Extract factual claims from structured output text.
 *
 * Targets claim patterns: "X has/is/was/holds/possesses Y",
 * numbered lists, bullet assertions.
 *
 * In production this is done by a T0 LLM extraction prompt.
 * Rule-based extraction handles the common patterns deterministically.
 */
function extractClaims(output: string): string[] {
  const claims: string[] = [];
  const lines = output.split(/\n+/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 10) continue;

    // Bullet point or numbered list items are likely factual claims
    if (/^[-•*]\s+\S/.test(trimmed) || /^\d+\.\s+\S/.test(trimmed)) {
      claims.push(trimmed.replace(/^[-•*\d.]\s+/, ""));
      continue;
    }

    // Sentences with assertion verbs: "X has/is/possesses/holds Y"
    if (/\b(a|possède|détient|dispose de|certifié|qualifié|maîtrise|a obtenu)\b/i.test(trimmed)) {
      claims.push(trimmed);
    }
  }

  return claims.slice(0, 20); // cap at 20 claims per output
}

// ── verifyClaim ───────────────────────────────────────────────────────────────

/**
 * Verify a single claim against the context string.
 *
 * Returns 'supported' if the context directly mentions the claim subject matter,
 * 'contradicted' if context contains an explicit negation, 'unsupported' otherwise.
 */
function verifyClaim(
  claim:   string,
  context: string,
): { verdict: HallucinationVerdict; source: string | null; confidence: number } {
  const claimLower   = claim.toLowerCase();
  const contextLower = context.toLowerCase();

  // Extract key noun phrases (simplified: words > 4 chars that aren't stopwords)
  const keyTerms = extractKeyTerms(claimLower);
  if (keyTerms.length === 0) {
    return { verdict: "unsupported", source: null, confidence: 0.5 };
  }

  // Find supporting sentence in context
  const contextSentences = context.split(/[.!?]\s+/);
  let bestMatch: string | null = null;
  let matchScore = 0;

  for (const sentence of contextSentences) {
    const sentLower = sentence.toLowerCase();
    const hits = keyTerms.filter((t) => sentLower.includes(t)).length;
    const score = hits / keyTerms.length;
    if (score > matchScore) {
      matchScore = score;
      bestMatch = sentence.trim();
    }
  }

  // Negation patterns that would contradict the claim
  const negationPatterns = [
    /\b(pas de|aucun|aucune|ne.*pas|non certifié|non qualifié|without|no|not)\b/i,
  ];

  if (matchScore > 0.5 && bestMatch) {
    const contradicted = negationPatterns.some((p) => p.test(bestMatch!));
    if (contradicted) {
      return { verdict: "contradicted", source: bestMatch, confidence: 0.8 };
    }
    return { verdict: "supported", source: bestMatch, confidence: matchScore };
  }

  return { verdict: "unsupported", source: null, confidence: 0.6 };
}

function extractKeyTerms(text: string): string[] {
  const stopwords = new Set(["the","a","an","is","are","was","were","has","have","had","de","le","la","les","un","une","des","est","sont","a","à"]);
  return text
    .replace(/[^a-zàâéèêëîïôùûüç\s]/gi, "")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !stopwords.has(w))
    .slice(0, 8);
}
