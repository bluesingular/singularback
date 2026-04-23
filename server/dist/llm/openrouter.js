/**
 * server/src/llm/openrouter.ts
 *
 * OpenRouter API caller — the single point through which all LLM calls flow.
 *
 * RULE 1: Every call is guarded by assertGdprSafe() before the HTTP request.
 *         If the model is not EU-hosted for a GDPR skill, throws immediately.
 * RULE 2: Credentials are never passed to this function — tools call the vault
 *         separately and return only clean, pseudonymised content.
 *
 * Cost tracking: stub for M3; full implementation in M7 (cost_records table).
 */
import { assertGdprSafe } from "./router.js";
export class LLMError extends Error {
    statusCode;
    model;
    constructor(message, statusCode, model) {
        super(message);
        this.statusCode = statusCode;
        this.model = model;
        this.name = "LLMError";
    }
}
// ── Caller ────────────────────────────────────────────────────────────────────
/**
 * Call an LLM via OpenRouter.
 *
 * Guards:
 * 1. GDPR invariant checked before any HTTP call (assertGdprSafe)
 * 2. Non-2xx responses throw LLMError with status code
 * 3. Usage tracked via costService stub (full impl in M7)
 */
export async function callLLM(params) {
    // RULE 1: GDPR guard — throws GdprViolationError if model is unsafe
    assertGdprSafe(params.model, params.gdprRequired ?? false, params.skillName ?? "unknown");
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new LLMError("OPENROUTER_API_KEY is not configured", 500, params.model);
    }
    const body = {
        model: params.model,
        messages: params.messages,
        max_tokens: params.maxOutputTokens,
        temperature: 0.3,
    };
    if (params.tools && params.tools.length > 0) {
        body.tools = params.tools;
    }
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.APP_URL ?? "https://singular.blue",
            "X-Title": "Singular Platform",
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const err = (await response.json().catch(() => ({})));
        throw new LLMError(`OpenRouter error: ${err.error?.message ?? response.statusText}`, response.status, params.model);
    }
    const data = (await response.json());
    const result = {
        id: data.id,
        model: data.model,
        choices: data.choices,
        usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
        },
    };
    // M7 stub: cost recording will be implemented with the cost_records table.
    // recordUsage({ companyId, agentId, taskId, model, inputTokens, outputTokens })
    await recordUsageStub(params, result.usage);
    return result;
}
/**
 * Stub cost recorder — replaced by full costService.recordUsage() in M7.
 * Intentionally async to match the M7 signature.
 */
async function recordUsageStub(params, usage) {
    // M7: await costService.recordUsage({ ...params, inputTokens: usage.promptTokens, outputTokens: usage.completionTokens })
    void params;
    void usage;
}
//# sourceMappingURL=openrouter.js.map