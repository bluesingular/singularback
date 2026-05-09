import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import { asString, asNumber, parseObject } from "../utils.js";

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message?: { role: string; content: string };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

// ---------------------------------------------------------------------------
// Paperclip API helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the Paperclip API base URL.
 * The server stamps PAPERCLIP_API_URL into the environment at startup.
 */
function getPaperclipApiBase(): string {
  return (process.env.PAPERCLIP_API_URL ?? "").replace(/\/$/, "");
}

/**
 * Post a comment on an issue and mark it as done.
 * Only called when the adapter has an authToken (supportsLocalAgentJwt: true)
 * and there is an active issue context.
 */
async function closeIssueWithResponse(opts: {
  issueId: string;
  authToken: string;
  responseText: string;
}): Promise<void> {
  const apiBase = getPaperclipApiBase();
  if (!apiBase) return;

  const { issueId, authToken, responseText } = opts;
  const headers = {
    "content-type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };

  // 1. Post the model's response as a comment on the issue
  if (responseText.trim()) {
    await fetch(`${apiBase}/api/issues/${issueId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: responseText }),
    }).catch(() => undefined);
  }

  // 2. Mark the issue as done so the reconciler stops re-queuing it
  await fetch(`${apiBase}/api/issues/${issueId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "done" }),
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Wake payload helpers
// ---------------------------------------------------------------------------

interface PaperclipIssueSummary {
  id: string;
  identifier: string | null;
  title: string;
  status: string;
  priority: string;
}

interface PaperclipWakePayload {
  reason?: string | null;
  issue?: PaperclipIssueSummary | null;
  comments?: Array<{ body: string; author?: { type: string } }>;
}

function parsePaperclipWake(raw: unknown): PaperclipWakePayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as PaperclipWakePayload;
}

/**
 * Fetch the full issue (including body) from the Paperclip API.
 * Only called when authToken and PAPERCLIP_API_URL are available.
 */
async function fetchIssueBody(
  issueId: string,
  authToken: string,
): Promise<string | null> {
  const apiBase = (process.env.PAPERCLIP_API_URL ?? "").replace(/\/$/, "");
  if (!apiBase) return null;
  try {
    const res = await fetch(
      `${apiBase}/api/issues/${issueId}`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { body?: string | null };
    return typeof data.body === "string" && data.body.trim() ? data.body : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Message builder
// ---------------------------------------------------------------------------

async function buildMessages(ctx: AdapterExecutionContext): Promise<OllamaMessage[]> {
  const messages: OllamaMessage[] = [];

  // System prompt — agent instructions (stored in adapterConfig under "instructions")
  const agentInstructions = asString(ctx.config.instructions, "");
  if (agentInstructions) {
    messages.push({ role: "system", content: agentInstructions });
  }

  // User prompt — assemble from context fields Paperclip passes at runtime
  const parts: string[] = [];

  // ── Wake payload (key is "paperclipWake", not "wakePayload") ─────────────
  const wakePayload = parsePaperclipWake(ctx.context["paperclipWake"]);

  const wakeReason =
    asString(wakePayload?.reason, "") ||
    asString(ctx.context.wakeReason, "");
  if (wakeReason) parts.push(`Wake reason: ${wakeReason}`);

  // ── Issue context ────────────────────────────────────────────────────────
  const issueFromWake = wakePayload?.issue;
  const issueTitle =
    issueFromWake?.title ||
    asString(ctx.context.issueTitle, "");
  const issueIdentifier = issueFromWake?.identifier ?? null;
  const issueStatus = issueFromWake?.status ?? null;

  if (issueTitle) {
    const label = issueIdentifier ? `${issueIdentifier}: ${issueTitle}` : issueTitle;
    parts.push(`Task: ${label}`);
  }
  if (issueStatus) {
    parts.push(`Status: ${issueStatus}`);
  }

  // Prefer issueBody from context (set by comment wakeups); fall back to API
  const issueBodyFromCtx = asString(ctx.context.issueBody, "");
  if (issueBodyFromCtx) {
    parts.push(issueBodyFromCtx);
  } else if (issueFromWake?.id && ctx.authToken) {
    const fetched = await fetchIssueBody(
      issueFromWake.id,
      ctx.authToken,
    );
    if (fetched) parts.push(fetched);
  }

  // ── Comments (if agent was woken by a comment) ───────────────────────────
  if (wakePayload?.comments && wakePayload.comments.length > 0) {
    const commentText = wakePayload.comments
      .map((c) => `[${c.author?.type ?? "user"}]: ${c.body}`)
      .join("\n");
    parts.push(`Recent comments:\n${commentText}`);
  }

  // Raw prompt fallback
  const rawPrompt = asString(ctx.context.prompt, "");
  if (rawPrompt && parts.length === 0) parts.push(rawPrompt);

  if (parts.length === 0) parts.push("Perform your next heartbeat task.");

  messages.push({ role: "user", content: parts.join("\n\n") });
  return messages;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, onLog } = ctx;

  const host = asString(config.host, "http://localhost:11434").replace(/\/$/, "");
  const model = asString(config.model, "");
  if (!model) {
    throw new Error(
      'Ollama adapter requires a "model" field in the agent configuration (e.g. model: gemma4:latest). No default is set — choose the model you have pulled locally.'
    );
  }
  const rawTimeoutSec = asNumber(config.timeoutSec, 300);
  const timeoutSec = rawTimeoutSec > 0 ? rawTimeoutSec : 300;
  const extraOptions = parseObject(config.options);

  const messages = await buildMessages(ctx);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

  let fullContent = "";
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    const res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: extraOptions ?? {},
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `Ollama returned HTTP ${res.status}: ${body}`,
        model,
      };
    }

    if (!res.body) {
      return { exitCode: 1, signal: null, timedOut: false, errorMessage: "Ollama returned no body", model };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as OllamaStreamChunk;
          const token = chunk.message?.content ?? "";
          if (token) {
            fullContent += token;
            await onLog("stdout", token);
          }
          if (chunk.done) {
            promptTokens = chunk.prompt_eval_count ?? 0;
            completionTokens = chunk.eval_count ?? 0;
          }
        } catch {
          // ignore malformed chunk
        }
      }
    }

    // Close the issue with the model's response so Paperclip's reconciler does
    // not keep re-queuing it as a stranded in_progress issue.
    const issueId = typeof ctx.context.issueId === "string" ? ctx.context.issueId : null;
    if (issueId && ctx.authToken) {
      await closeIssueWithResponse({
        issueId,
        authToken: ctx.authToken,
        responseText: fullContent,
      });
    }

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      model,
      provider: "ollama",
      summary: fullContent.slice(0, 200) || undefined,
      usage: promptTokens > 0 || completionTokens > 0
        ? { inputTokens: promptTokens, outputTokens: completionTokens }
        : undefined,
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return {
      exitCode: 1,
      signal: null,
      timedOut,
      errorMessage: timedOut
        ? `Ollama run timed out after ${timeoutSec}s`
        : err instanceof Error ? err.message : String(err),
      model,
    };
  } finally {
    clearTimeout(timer);
  }
}
