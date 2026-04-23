import type { AdapterSkillContext, AdapterSkillSnapshot } from "@paperclipai/adapter-utils";
export declare function listClaudeSkills(ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot>;
export declare function syncClaudeSkills(ctx: AdapterSkillContext, _desiredSkills: string[]): Promise<AdapterSkillSnapshot>;
export declare function resolveClaudeDesiredSkillNames(config: Record<string, unknown>, availableEntries: Array<{
    key: string;
    required?: boolean;
}>): string[];
//# sourceMappingURL=skills.d.ts.map