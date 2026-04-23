import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
export declare function pathExists(candidate: string): Promise<boolean>;
export declare function resolveSharedCodexHomeDir(env?: NodeJS.ProcessEnv): string;
export declare function resolveManagedCodexHomeDir(env: NodeJS.ProcessEnv, companyId?: string): string;
export declare function prepareManagedCodexHome(env: NodeJS.ProcessEnv, onLog: AdapterExecutionContext["onLog"], companyId?: string): Promise<string>;
//# sourceMappingURL=codex-home.d.ts.map