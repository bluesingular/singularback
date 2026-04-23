import { asString, asNumber, parseObject } from "../utils.js";
function buildMessages(ctx) {
    const messages = [];
    // User prompt — assemble from context fields Paperclip passes at runtime
    const parts = [];
    const wakeReason = asString(ctx.context.wakeReason, "");
    if (wakeReason)
        parts.push(`Wake reason: ${wakeReason}`);
    const issueTitle = asString(ctx.context.issueTitle, "");
    const issueBody = asString(ctx.context.issueBody, "");
    if (issueTitle)
        parts.push(`Task: ${issueTitle}`);
    if (issueBody)
        parts.push(issueBody);
    const wakePayload = ctx.context.wakePayload;
    if (wakePayload && typeof wakePayload === "string")
        parts.push(wakePayload);
    // Raw prompt fallback
    const rawPrompt = asString(ctx.context.prompt, "");
    if (rawPrompt && parts.length === 0)
        parts.push(rawPrompt);
    if (parts.length === 0)
        parts.push("Perform your next heartbeat task.");
    messages.push({ role: "user", content: parts.join("\n\n") });
    return messages;
}
export async function execute(ctx) {
    const { config, onLog } = ctx;
    const host = asString(config.host, "http://localhost:11434").replace(/\/$/, "");
    const model = asString(config.model, "llama3.2");
    const rawTimeoutSec = asNumber(config.timeoutSec, 300);
    const timeoutSec = rawTimeoutSec > 0 ? rawTimeoutSec : 300;
    const extraOptions = parseObject(config.options);
    const messages = buildMessages(ctx);
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
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                try {
                    const chunk = JSON.parse(trimmed);
                    const token = chunk.message?.content ?? "";
                    if (token) {
                        fullContent += token;
                        await onLog("stdout", token);
                    }
                    if (chunk.done) {
                        promptTokens = chunk.prompt_eval_count ?? 0;
                        completionTokens = chunk.eval_count ?? 0;
                    }
                }
                catch {
                    // ignore malformed chunk
                }
            }
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
    }
    catch (err) {
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
    }
    finally {
        clearTimeout(timer);
    }
}
//# sourceMappingURL=execute.js.map