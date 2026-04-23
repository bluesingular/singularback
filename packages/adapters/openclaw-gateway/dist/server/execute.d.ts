import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
type SessionKeyStrategy = "fixed" | "issue" | "run";
export declare function resolveSessionKey(input: {
    strategy: SessionKeyStrategy;
    configuredSessionKey: string | null;
    agentId: string | null;
    runId: string;
    issueId: string | null;
}): string;
export declare function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult>;
export {};
//# sourceMappingURL=execute.d.ts.map