import { type AdapterExecutionContext, type AdapterExecutionResult } from "@paperclipai/adapter-utils";
type EnsureCodexSkillsInjectedOptions = {
    skillsHome?: string;
    skillsEntries?: Array<{
        key: string;
        runtimeName: string;
        source: string;
    }>;
    desiredSkillNames?: string[];
    linkSkill?: (source: string, target: string) => Promise<void>;
};
export declare function ensureCodexSkillsInjected(onLog: AdapterExecutionContext["onLog"], options?: EnsureCodexSkillsInjectedOptions): Promise<void>;
export declare function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult>;
export {};
//# sourceMappingURL=execute.d.ts.map