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
import type { Db } from "@paperclipai/db";
import type { ParsedSkill } from "../skills/parser.js";
export declare class ForbiddenError extends Error {
    constructor(message: string);
}
export interface WebBrowseInput {
    url: string;
    intent?: string;
    mode: "scrape" | "extract";
    maxPages?: number;
    schema?: Record<string, unknown>;
}
export interface WebBrowseOutput {
    url: string;
    title: string;
    content: string;
    metadata: {
        date?: string;
        author?: string;
        canonical?: string;
    };
    tokensEstimate: number;
}
export interface WebBrowseContext {
    db: Db;
    companyId: string;
    agentId: string;
    taskId: string;
    skill: ParsedSkill;
}
export declare function webBrowse(input: WebBrowseInput, context: WebBrowseContext): Promise<WebBrowseOutput>;
//# sourceMappingURL=webBrowse.d.ts.map