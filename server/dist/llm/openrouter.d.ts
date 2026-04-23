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
export interface OpenAIMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface OpenAITool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}
export interface LLMUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}
export interface LLMChoice {
    message: {
        role: "assistant";
        content: string | null;
        tool_calls?: Array<{
            id: string;
            type: "function";
            function: {
                name: string;
                arguments: string;
            };
        }>;
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter";
}
export interface LLMResponse {
    id: string;
    model: string;
    choices: LLMChoice[];
    usage: LLMUsage;
}
export declare class LLMError extends Error {
    readonly statusCode: number;
    readonly model?: string | undefined;
    constructor(message: string, statusCode: number, model?: string | undefined);
}
export interface CallLLMParams {
    model: string;
    messages: OpenAIMessage[];
    tools?: OpenAITool[];
    maxOutputTokens: number;
    /** Used for cost tracking (M7) and audit logging */
    companyId: string;
    agentId: string;
    taskId: string;
    /** Required when skill has gdpr_required: true */
    gdprRequired?: boolean;
    /** Skill name — used in GDPR violation error messages */
    skillName?: string;
}
/**
 * Call an LLM via OpenRouter.
 *
 * Guards:
 * 1. GDPR invariant checked before any HTTP call (assertGdprSafe)
 * 2. Non-2xx responses throw LLMError with status code
 * 3. Usage tracked via costService stub (full impl in M7)
 */
export declare function callLLM(params: CallLLMParams): Promise<LLMResponse>;
//# sourceMappingURL=openrouter.d.ts.map