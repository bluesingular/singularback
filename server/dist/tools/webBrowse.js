/**
 * server/src/tools/webBrowse.ts
 *
 * Web browsing tool — fetches and cleans web content for agent use.
 *
 * Architecture:
 *   1. Permission check (skill.webAccess must be true)
 *   2. Domain whitelist check (if skill.webScope === 'restricted')
 *   3. Firecrawl primary (scrape or extract mode)
 *   4. Jina Reader fallback if Firecrawl fails
 *   5. GDPR flag if skill.gdprRequired (logs warning — full review in M6)
 *   6. Every URL fetch logged to tool_call_log (AI Act audit requirement)
 *
 * RULE 2: credentials (FIRECRAWL_API_KEY) never reach LLM.
 * The agent receives clean markdown only.
 */
import FirecrawlApp from "@mendable/firecrawl-js";
import { toolCallLog } from "@paperclipai/db";
import { estimateTokens } from "../context/tokens.js";
import pino from "pino";
const logger = pino({ name: "web-browse" });
// ── Error types ───────────────────────────────────────────────────────────────
export class ForbiddenError extends Error {
    constructor(message) {
        super(message);
        this.name = "ForbiddenError";
    }
}
// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Returns the agent's domain whitelist.
 * Stub for M5 — M8 will add per-agent whitelist stored in DB.
 */
async function getAgentWebWhitelist(_db, _agentId) {
    return [];
}
/**
 * Flags content that may contain personal data for GDPR review.
 * Full implementation in M6 (audit_entries table).
 */
async function flagForGDPRReview(companyId, url, contentLength) {
    logger.warn({ companyId, url, contentLength }, "web-browse: GDPR flag — content may contain personal data, manual review required");
}
async function jinaFallback(url) {
    const response = await fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: "text/markdown" },
    });
    const markdown = await response.text();
    return {
        url,
        title: "",
        content: markdown,
        metadata: {},
        tokensEstimate: estimateTokens(markdown),
    };
}
function createFirecrawl() {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
        throw new Error("FIRECRAWL_API_KEY is not configured");
    }
    return new FirecrawlApp({ apiKey });
}
// ── Main function ─────────────────────────────────────────────────────────────
export async function webBrowse(input, context) {
    // 1. Permission check — throws ForbiddenError (not logged to audit)
    if (!context.skill.webAccess) {
        throw new ForbiddenError("This skill does not have web browsing access");
    }
    // 2. Domain whitelist check
    if (context.skill.webScope === "restricted") {
        const allowed = await getAgentWebWhitelist(context.db, context.agentId);
        const domain = new URL(input.url).hostname;
        if (!allowed.includes(domain)) {
            throw new ForbiddenError(`Domain ${domain} not in this agent's web whitelist`);
        }
    }
    const startTime = Date.now();
    let result;
    let errorMsg;
    try {
        const firecrawl = createFirecrawl();
        if (input.mode === "scrape") {
            const scraped = await firecrawl.scrape(input.url, {
                formats: ["markdown"],
                onlyMainContent: true,
            });
            result = {
                url: input.url,
                title: scraped.metadata?.title ?? "",
                content: scraped.markdown ?? "",
                metadata: {
                    date: scraped.metadata?.publishedTime,
                    author: scraped.metadata?.author,
                    canonical: scraped.metadata?.sourceURL,
                },
                tokensEstimate: estimateTokens(scraped.markdown ?? ""),
            };
        }
        else if (input.mode === "extract" && input.schema) {
            // extract() takes a single params object with urls array
            const extracted = await firecrawl.extract({ urls: [input.url], prompt: input.intent });
            result = {
                url: input.url,
                title: "",
                content: JSON.stringify(extracted.data, null, 2),
                metadata: {},
                tokensEstimate: estimateTokens(JSON.stringify(extracted.data)),
            };
        }
        else {
            throw new Error(`Unknown browse mode: ${input.mode}`);
        }
        // GDPR flag if skill handles personal data
        if (context.skill.gdprRequired && result) {
            await flagForGDPRReview(context.companyId, input.url, result.content.length);
        }
    }
    catch (err) {
        errorMsg = String(err);
        logger.warn({ err, url: input.url }, "web-browse: Firecrawl failed, falling back to Jina Reader");
        result = await jinaFallback(input.url);
    }
    finally {
        // Audit every URL fetch — AI Act requirement (even on Firecrawl failure)
        await context.db.insert(toolCallLog).values({
            companyId: context.companyId,
            agentId: context.agentId,
            taskId: context.taskId,
            toolType: "web_browse",
            toolName: "firecrawl",
            input: { url: input.url, mode: input.mode },
            output: result
                ? { title: result.title, tokensEstimate: result.tokensEstimate }
                : null,
            status: errorMsg ? "failed" : "success",
            durationMs: String(Date.now() - startTime),
            error: errorMsg ?? null,
        });
    }
    return result;
}
//# sourceMappingURL=webBrowse.js.map