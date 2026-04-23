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

// ── Types ─────────────────────────────────────────────────────────────────────

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
      function: { name: string; arguments: string };
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

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly model?: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
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

// ── Caller ────────────────────────────────────────────────────────────────────

/**
 * Call an LLM via OpenRouter.
 *
 * Guards:
 * 1. GDPR invariant checked before any HTTP call (assertGdprSafe)
 * 2. Non-2xx responses throw LLMError with status code
 * 3. Usage tracked via costService stub (full impl in M7)
 */
export async function callLLM(params: CallLLMParams): Promise<LLMResponse> {
  // RULE 1: GDPR guard — throws GdprViolationError if model is unsafe
  assertGdprSafe(
    params.model,
    params.gdprRequired ?? false,
    params.skillName ?? "unknown",
  );

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new LLMError("OPENROUTER_API_KEY is not configured", 500, params.model);
  }

  const body: Record<string, unknown> = {
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
    const err = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new LLMError(
      `OpenRouter error: ${err.error?.message ?? response.statusText}`,
      response.status,
      params.model,
    );
  }

  const data = (await response.json()) as {
    id: string;
    model: string;
    choices: Array<{
      message: { role: "assistant"; content: string | null; tool_calls?: unknown[] };
      finish_reason: string;
    }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const result: LLMResponse = {
    id: data.id,
    model: data.model,
    choices: data.choices as LLMChoice[],
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
async function recordUsageStub(
  params: Pick<CallLLMParams, "companyId" | "agentId" | "taskId" | "model">,
  usage: LLMUsage,
): Promise<void> {
  // M7: await costService.recordUsage({ ...params, inputTokens: usage.promptTokens, outputTokens: usage.completionTokens })
  void params;
  void usage;
}
