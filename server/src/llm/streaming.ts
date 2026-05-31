/**
 * G6 — Streaming LLM service.
 *
 * executeWithStreaming() wraps callLLMStream() and publishes each text chunk
 * as an agent.writing SSE event to all connections for the company.
 *
 * This is the single integration point between the LLM caller and the SSE layer.
 * Workers that want streaming output call this instead of callLLM().
 */

import { callLLMStream } from "./openrouter.js";
import type { CallLLMParams, LLMResponse } from "./openrouter.js";
import { sseManager } from "../realtime/sse.js";
import { publishAgentReading, publishAgentAnalysing } from "../realtime/publish.js";

export interface StreamingParams extends CallLLMParams {
  /** Published in each agent.writing SSE event so the UI can filter by task */
  taskId:    string;
  agentId:   string;
  companyId: string;
}

/**
 * Execute an LLM call in streaming mode.
 *
 * Each text chunk is:
 *   1. Appended to the internal buffer (returned in the final LLMResponse)
 *   2. Published as an `agent.writing` SSE event to all company connections
 *
 * If no SSE connections are open for the company, chunks still stream through
 * to completion — the function does not require a live SSE subscriber.
 */
export async function executeWithStreaming(params: StreamingParams): Promise<LLMResponse> {
  const { companyId, taskId, agentId } = params;

  // Signal that the agent is now analysing (thinking before writing)
  publishAgentAnalysing({ companyId, taskId, agentId, step: "llm_call" });

  const response = await callLLMStream(params, (chunk) => {
    sseManager.publishEvent(companyId, {
      type: "agent.writing",
      data: { taskId, agentId, chunk },
    });
  });

  // Signal completion so the UI can stop the typing indicator
  sseManager.publishEvent(companyId, {
    type: "agent.writing",
    data: { taskId, agentId, chunk: "", done: true },
  });

  return response;
}
