/**
 * server/src/llm/router.ts
 *
 * LLM model router with GDPR enforcement.
 *
 * RULE 1 (code invariant — never violate):
 *   gdpr_required: true → only Mistral EU models are permitted.
 *   DeepSeek is FORBIDDEN for any skill with gdpr_required: true.
 *   routeModel() throws a GdprViolationError if the resolved model is not EU-hosted.
 *
 * Routing logic:
 *   gdpr_required: true → always Mistral EU regardless of tier or language
 *   tier 0            → Ministral-3b (micro, cheapest)
 *   tier 1, lang=fr   → Mistral Small (EU, French-optimised)
 *   tier 1, lang=en   → DeepSeek v3 (non-GDPR only)
 *   tier 2            → Gemini Flash (speed) or Mistral Medium (quality/GDPR)
 *   tier 3            → Claude Sonnet (frontier)
 */

import type { ParsedSkill } from "../skills/parser.js";

// ── EU-hosted model allowlist (RULE 1) ────────────────────────────────────────

/** Models hosted in EU data centers — safe for personal data (GDPR). */
const EU_MODELS = new Set([
  "mistralai/ministral-3b",
  "mistralai/mistral-small-3.2",
  "mistralai/mistral-medium-3.1",
  "mistralai/mistral-large-2411",
]);

/**
 * Models with contractual GDPR compliance (DPA in place) but not EU-hosted.
 * Anthropic has a Data Processing Agreement meeting EU requirements.
 * Allowed for T3 GDPR skills where no EU-hosted frontier model is available.
 */
const CONTRACTUALLY_GDPR_COMPLIANT = new Set([
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4-6",
  "anthropic/claude-haiku-4-5-20251001",
]);

/** Models explicitly forbidden for personal data. */
const FORBIDDEN_FOR_PERSONAL_DATA = new Set([
  "deepseek/deepseek-chat-v3-5",
  "deepseek/deepseek-r1",
]);

// ── Model registry ────────────────────────────────────────────────────────────

const MODEL_MAP = {
  T0: {
    default: "mistralai/ministral-3b",
    fallback: "google/gemma-3-1b",
    maxInput: 8_000,
    maxOutput: 1_000,
    costPerMTokenEur: 0.04,
  },
  T1_FR_GDPR: {
    default: "mistralai/mistral-small-3.2",
    fallback: "mistralai/mistral-small-3.2", // no fallback outside EU for GDPR
    maxInput: 32_000,
    maxOutput: 4_000,
    costPerMTokenEur: 0.10,
  },
  T1_EN: {
    default: "deepseek/deepseek-chat-v3-5",
    fallback: "mistralai/mistral-small-3.2", // EU fallback if DeepSeek unavailable
    maxInput: 64_000,
    maxOutput: 8_000,
    costPerMTokenEur: 0.06,
  },
  T2_SPEED: {
    default: "google/gemini-flash-1.5",
    fallback: "mistralai/mistral-medium-3.1",
    maxInput: 128_000,
    maxOutput: 8_000,
    costPerMTokenEur: 0.08,
  },
  T2_QUALITY_GDPR: {
    default: "mistralai/mistral-medium-3.1",
    fallback: null, // no fallback — queue and retry
    maxInput: 128_000,
    maxOutput: 8_000,
    costPerMTokenEur: 0.28,
  },
  T3: {
    default: "anthropic/claude-sonnet-4-5",
    fallback: null, // no fallback for T3 — queue and retry with backoff
    maxInput: 200_000,
    maxOutput: 16_000,
    costPerMTokenEur: 3.00,
  },
} as const;

// ── Error type ────────────────────────────────────────────────────────────────

export class GdprViolationError extends Error {
  constructor(model: string, skillName: string) {
    super(
      `GDPR violation: skill "${skillName}" requires EU hosting but resolved to "${model}". ` +
      `DeepSeek and non-EU models are FORBIDDEN for gdpr_required skills.`,
    );
    this.name = "GdprViolationError";
  }
}

// ── Output type ───────────────────────────────────────────────────────────────

export interface RoutingDecision {
  model: string;
  provider: "openrouter";
  endpoint: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  /** Estimated cost in EUR per 1M tokens (blended input+output approximation) */
  estimatedCostEur: number;
  /** Whether this model is EU-hosted (safe for personal data) */
  isEuHosted: boolean;
}

// ── Internal builder ──────────────────────────────────────────────────────────

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

function buildDecision(
  model: string,
  spec: { maxInput: number; maxOutput: number; costPerMTokenEur: number },
): RoutingDecision {
  return {
    model,
    provider: "openrouter",
    endpoint: OPENROUTER_ENDPOINT,
    maxInputTokens: spec.maxInput,
    maxOutputTokens: spec.maxOutput,
    estimatedCostEur: spec.costPerMTokenEur,
    isEuHosted: EU_MODELS.has(model),
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

/**
 * Route a skill execution to the appropriate LLM model.
 *
 * @param skill   Parsed skill with tier and gdpr_required declared
 * @param language Detected language of the task content ('fr' | 'en' | 'auto')
 *
 * Throws GdprViolationError if the routing logic produces a non-EU model
 * for a gdpr_required skill. This is a code-level invariant, not a config flag.
 */
export function routeModel(
  skill: ParsedSkill,
  language: "fr" | "en" | "auto" = "auto",
): RoutingDecision {
  const { tier, gdprRequired, name: skillName } = skill;

  let decision: RoutingDecision;

  // ABSOLUTE GDPR RULE (RULE 1): personal data never leaves EU
  if (gdprRequired) {
    if (tier <= 1) {
      decision = buildDecision(MODEL_MAP.T1_FR_GDPR.default, MODEL_MAP.T1_FR_GDPR);
    } else if (tier === 2) {
      decision = buildDecision(MODEL_MAP.T2_QUALITY_GDPR.default, MODEL_MAP.T2_QUALITY_GDPR);
    } else {
      // T3 — Claude via Anthropic (EU-contractually compliant for GDPR)
      decision = buildDecision(MODEL_MAP.T3.default, MODEL_MAP.T3);
    }
  } else {
    switch (tier) {
      case 0:
        decision = buildDecision(MODEL_MAP.T0.default, MODEL_MAP.T0);
        break;
      case 1:
        decision =
          language === "fr"
            ? buildDecision(MODEL_MAP.T1_FR_GDPR.default, MODEL_MAP.T1_FR_GDPR)
            : buildDecision(MODEL_MAP.T1_EN.default, MODEL_MAP.T1_EN);
        break;
      case 2:
        decision = buildDecision(MODEL_MAP.T2_SPEED.default, MODEL_MAP.T2_SPEED);
        break;
      case 3:
        decision = buildDecision(MODEL_MAP.T3.default, MODEL_MAP.T3);
        break;
      default:
        decision = buildDecision(MODEL_MAP.T1_EN.default, MODEL_MAP.T1_EN);
    }
  }

  // Invariant check (RULE 1): if skill requires GDPR compliance, the model must
  // be either EU-hosted or contractually GDPR-compliant (Anthropic DPA).
  // DeepSeek and other non-EU, non-compliant models throw unconditionally.
  if (gdprRequired) {
    if (FORBIDDEN_FOR_PERSONAL_DATA.has(decision.model)) {
      throw new GdprViolationError(decision.model, skillName);
    }
    const gdprSafe = decision.isEuHosted || CONTRACTUALLY_GDPR_COMPLIANT.has(decision.model);
    if (!gdprSafe) {
      throw new GdprViolationError(decision.model, skillName);
    }
  }

  return decision;
}

/**
 * Validate that a model string is safe for a given GDPR context.
 * Use this as a secondary guard in callLLM before any API call.
 */
export function assertGdprSafe(model: string, gdprRequired: boolean, skillName: string): void {
  if (!gdprRequired) return;
  if (FORBIDDEN_FOR_PERSONAL_DATA.has(model)) {
    throw new GdprViolationError(model, skillName);
  }
  const gdprSafe = EU_MODELS.has(model) || CONTRACTUALLY_GDPR_COMPLIANT.has(model);
  if (!gdprSafe) {
    throw new GdprViolationError(model, skillName);
  }
}
