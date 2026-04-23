export interface PaperclipMcpConfig {
    apiUrl: string;
    apiKey: string;
    companyId: string | null;
    agentId: string | null;
    runId: string | null;
}
export declare function normalizeApiUrl(apiUrl: string): string;
export declare function readConfigFromEnv(env?: NodeJS.ProcessEnv): PaperclipMcpConfig;
//# sourceMappingURL=config.d.ts.map