import type { PaperclipMcpConfig } from "./config.js";
export declare class PaperclipApiError extends Error {
    readonly status: number;
    readonly method: string;
    readonly path: string;
    readonly body: unknown;
    constructor(input: {
        status: number;
        method: string;
        path: string;
        body: unknown;
        message: string;
    });
}
export interface JsonRequestOptions {
    body?: unknown;
    includeRunId?: boolean;
}
export declare class PaperclipApiClient {
    private readonly config;
    constructor(config: PaperclipMcpConfig);
    get defaults(): {
        companyId: string | null;
        agentId: string | null;
        runId: string | null;
    };
    resolveCompanyId(companyId?: string | null): string;
    resolveAgentId(agentId?: string | null): string;
    requestJson<T>(method: string, path: string, options?: JsonRequestOptions): Promise<T>;
}
//# sourceMappingURL=client.d.ts.map