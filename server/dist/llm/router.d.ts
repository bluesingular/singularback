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
export declare class GdprViolationError extends Error {
    constructor(model: string, skillName: string);
}
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
/**
 * Route a skill execution to the appropriate LLM model.
 *
 * @param skill   Parsed skill with tier and gdpr_required declared
 * @param language Detected language of the task content ('fr' | 'en' | 'auto')
 *
 * Throws GdprViolationError if the routing logic produces a non-EU model
 * for a gdpr_required skill. This is a code-level invariant, not a config flag.
 */
export declare function routeModel(skill: ParsedSkill, language?: "fr" | "en" | "auto"): RoutingDecision;
/**
 * Validate that a model string is safe for a given GDPR context.
 * Use this as a secondary guard in callLLM before any API call.
 */
export declare function assertGdprSafe(model: string, gdprRequired: boolean, skillName: string): void;
//# sourceMappingURL=router.d.ts.map