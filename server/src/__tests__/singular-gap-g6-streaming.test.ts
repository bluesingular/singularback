/**
 * G6 — Streaming LLM
 *
 * Tests:
 *  1.  callLLMStream — calls onChunk for each SSE text delta
 *  2.  callLLMStream — concatenates all chunks into final LLMResponse.content
 *  3.  callLLMStream — GDPR guard fires before any HTTP call (GdprViolationError)
 *  4.  callLLMStream — throws LLMError when OPENROUTER_API_KEY is missing
 *  5.  callLLMStream — throws LLMError when OpenRouter returns non-2xx
 *  6.  callLLMStream — [DONE] sentinel ends the stream cleanly
 *  7.  callLLMStream — malformed JSON lines are silently skipped
 *  8.  callLLMStream — usage tokens populated from final chunk
 *  9.  executeWithStreaming — publishes agent.writing SSE events per chunk
 * 10.  executeWithStreaming — publishes done sentinel after stream ends
 * 11.  executeWithStreaming — GDPR guard propagates through to callLLMStream
 * 12.  executeWithStreaming — returns full LLMResponse from callLLMStream
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Helpers ───────────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_ID    = "tttttttt-tttt-4ttt-8ttt-tttttttttttt";
const AGENT_ID   = "agent-001";

/** Build an SSE byte stream from a list of payload strings and an optional [DONE] sentinel */
function buildStream(payloads: string[], done = true): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines   = payloads.map(p => `data: ${p}\n\n`);
  if (done) lines.push("data: [DONE]\n\n");
  const text = lines.join("");

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function makeChunk(content: string, id = "resp-1", model = "mistralai/mistral-small-3.2") {
  return JSON.stringify({
    id,
    model,
    choices: [{ delta: { content }, finish_reason: null }],
    usage: null,
  });
}

function makeUsageChunk(promptTokens: number, completionTokens: number) {
  return JSON.stringify({
    id: "resp-1",
    model: "mistralai/mistral-small-3.2",
    choices: [{ delta: {}, finish_reason: "stop" }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
  });
}

// ── Tests: callLLMStream ───────────────────────────────────────────────────────

describe("G6 — callLLMStream", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.OPENROUTER_API_KEY = "sk-test-key";
  });

  it("1. calls onChunk for each SSE text delta", async () => {
    const stream = buildStream([makeChunk("Hello"), makeChunk(" world")]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    const { callLLMStream } = await import("../llm/openrouter.js");
    const chunks: string[] = [];
    await callLLMStream(
      { model: "mistralai/mistral-small-3.2", messages: [], maxOutputTokens: 100, companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID },
      (c) => chunks.push(c),
    );
    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("2. concatenates all chunks into final LLMResponse content", async () => {
    const stream = buildStream([makeChunk("Bonjour"), makeChunk(" Sophie")]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    const { callLLMStream } = await import("../llm/openrouter.js");
    const result = await callLLMStream(
      { model: "mistralai/mistral-small-3.2", messages: [], maxOutputTokens: 100, companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID },
      () => {},
    );
    expect(result.choices[0].message.content).toBe("Bonjour Sophie");
  });

  it("3. GDPR guard fires before any HTTP call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { callLLMStream, GdprViolationError } = await import("../llm/openrouter.js");
    await expect(
      callLLMStream(
        { model: "deepseek/deepseek-chat-v3-5", messages: [], maxOutputTokens: 100, companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID, gdprRequired: true, skillName: "qualification-cv" },
        () => {},
      ),
    ).rejects.toThrow(GdprViolationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("4. throws LLMError when OPENROUTER_API_KEY is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { callLLMStream, LLMError } = await import("../llm/openrouter.js");
    await expect(
      callLLMStream(
        { model: "mistralai/mistral-small-3.2", messages: [], maxOutputTokens: 100, companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID },
        () => {},
      ),
    ).rejects.toThrow(LLMError);
  });

  it("5. throws LLMError when OpenRouter returns non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: vi.fn().mockResolvedValue({ error: { message: "rate limited" } }),
    }));
    const { callLLMStream, LLMError } = await import("../llm/openrouter.js");
    await expect(
      callLLMStream(
        { model: "mistralai/mistral-small-3.2", messages: [], maxOutputTokens: 100, companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID },
        () => {},
      ),
    ).rejects.toThrow(LLMError);
  });

  it("6. [DONE] sentinel ends stream cleanly without error", async () => {
    const stream = buildStream([makeChunk("final")], true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    const { callLLMStream } = await import("../llm/openrouter.js");
    const result = await callLLMStream(
      { model: "mistralai/mistral-small-3.2", messages: [], maxOutputTokens: 100, companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID },
      () => {},
    );
    expect(result.choices[0].message.content).toBe("final");
  });

  it("7. malformed JSON lines are silently skipped", async () => {
    const encoder = new TextEncoder();
    const raw = "data: {invalid json}\n\ndata: " + makeChunk("ok") + "\n\ndata: [DONE]\n\n";
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(encoder.encode(raw)); c.close(); },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    const { callLLMStream } = await import("../llm/openrouter.js");
    const chunks: string[] = [];
    await callLLMStream(
      { model: "mistralai/mistral-small-3.2", messages: [], maxOutputTokens: 100, companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID },
      (c) => chunks.push(c),
    );
    expect(chunks).toEqual(["ok"]);
  });

  it("8. usage tokens populated from final chunk", async () => {
    const stream = buildStream([makeChunk("hi"), makeUsageChunk(50, 10)]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    const { callLLMStream } = await import("../llm/openrouter.js");
    const result = await callLLMStream(
      { model: "mistralai/mistral-small-3.2", messages: [], maxOutputTokens: 100, companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID },
      () => {},
    );
    expect(result.usage.promptTokens).toBe(50);
    expect(result.usage.completionTokens).toBe(10);
  });
});

// ── Tests: executeWithStreaming ────────────────────────────────────────────────

describe("G6 — executeWithStreaming", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.OPENROUTER_API_KEY = "sk-test-key";
  });

  it("9. publishes agent.writing SSE events per chunk", async () => {
    const stream = buildStream([makeChunk("chunk1"), makeChunk("chunk2")]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    const publishMock = vi.fn();
    vi.doMock("../realtime/sse.js", () => ({ sseManager: { publishEvent: publishMock } }));

    const { executeWithStreaming } = await import("../llm/streaming.js");
    await executeWithStreaming({
      model: "mistralai/mistral-small-3.2",
      messages: [], maxOutputTokens: 100,
      companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID,
    });

    const writingCalls = publishMock.mock.calls.filter(
      ([, ev]) => ev.type === "agent.writing" && !ev.data.done,
    );
    expect(writingCalls.length).toBe(2);
    expect(writingCalls[0][1].data.chunk).toBe("chunk1");
    expect(writingCalls[1][1].data.chunk).toBe("chunk2");
  });

  it("10. publishes done sentinel after stream ends", async () => {
    const stream = buildStream([makeChunk("x")]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    const publishMock = vi.fn();
    vi.doMock("../realtime/sse.js", () => ({ sseManager: { publishEvent: publishMock } }));

    const { executeWithStreaming } = await import("../llm/streaming.js");
    await executeWithStreaming({
      model: "mistralai/mistral-small-3.2",
      messages: [], maxOutputTokens: 100,
      companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID,
    });

    const doneCalls = publishMock.mock.calls.filter(
      ([, ev]) => ev.type === "agent.writing" && ev.data.done === true,
    );
    expect(doneCalls.length).toBe(1);
  });

  it("11. GDPR guard propagates through executeWithStreaming", async () => {
    vi.doMock("../realtime/sse.js", () => ({ sseManager: { publishEvent: vi.fn() } }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { executeWithStreaming } = await import("../llm/streaming.js");
    const { GdprViolationError } = await import("../llm/openrouter.js");

    await expect(
      executeWithStreaming({
        model: "deepseek/deepseek-chat-v3-5",
        messages: [], maxOutputTokens: 100,
        companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID,
        gdprRequired: true, skillName: "qualification-cv",
      }),
    ).rejects.toThrow(GdprViolationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("12. returns full LLMResponse from callLLMStream", async () => {
    const stream = buildStream([makeChunk("hello"), makeUsageChunk(20, 5)]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: stream }));

    vi.doMock("../realtime/sse.js", () => ({ sseManager: { publishEvent: vi.fn() } }));
    const { executeWithStreaming } = await import("../llm/streaming.js");

    const result = await executeWithStreaming({
      model: "mistralai/mistral-small-3.2",
      messages: [], maxOutputTokens: 100,
      companyId: COMPANY_ID, agentId: AGENT_ID, taskId: TASK_ID,
    });

    expect(result.choices[0].message.content).toBe("hello");
    expect(result.usage.promptTokens).toBe(20);
  });
});
