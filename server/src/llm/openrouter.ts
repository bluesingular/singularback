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
import { publishAgentToolCall } from "../realtime/publish.js";

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

export type ChunkCallback = (text: string) => void;

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

  // Publish agent.tool_call SSE events for each tool call in the response (M15)
  const toolCalls = result.choices[0]?.message?.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    for (const tc of toolCalls) {
      publishAgentToolCall({
        companyId:  params.companyId,
        taskId:     params.taskId,
        agentId:    params.agentId,
        toolName:   tc.function.name,
        toolCallId: tc.id,
      });
    }
  }

  // M7 stub: cost recording will be implemented with the cost_records table.
  // recordUsage({ companyId, agentId, taskId, model, inputTokens, outputTokens })
  await recordUsageStub(params, result.usage);

  return result;
}

/**
 * Stream an LLM response via OpenRouter's SSE API.
 *
 * Calls `onChunk(text)` for each text delta received.
 * Returns the full aggregated response once the stream closes.
 *
 * GDPR guard fires before any HTTP call — same invariant as callLLM.
 */
export async function callLLMStream(
  params: CallLLMParams,
  onChunk: ChunkCallback,
): Promise<LLMResponse> {
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
    stream: true,
    stream_options: { include_usage: true },
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
      `OpenRouter stream error: ${err.error?.message ?? response.statusText}`,
      response.status,
      params.model,
    );
  }

  if (!response.body) {
    throw new LLMError("OpenRouter returned empty stream body", 500, params.model);
  }

  // Parse SSE stream — OpenRouter uses standard OpenAI SSE format:
  //   data: {"choices":[{"delta":{"content":"..."}}],"usage":null}
  //   data: [DONE]
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer          = "";
  let responseId      = "";
  let resolvedModel   = params.model;
  let fullContent     = "";
  let promptTokens    = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete last line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;

      let chunk: {
        id?: string;
        model?: string;
        choices?: Array<{
          delta?: { content?: string | null };
          finish_reason?: string | null;
        }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
      };

      try {
        chunk = JSON.parse(payload);
      } catch {
        continue; // skip malformed chunks
      }

      if (chunk.id)    responseId    = chunk.id;
      if (chunk.model) resolvedModel = chunk.model;

      // Accumulate usage from any chunk that includes it (OpenRouter sends it in the last chunk)
      if (chunk.usage) {
        promptTokens     = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
      }

      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        onChunk(delta);
      }
    }
  }

  const result: LLMResponse = {
    id: responseId,
    model: resolvedModel,
    choices: [{
      message:       { role: "assistant", content: fullContent },
      finish_reason: "stop",
    }],
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };

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
