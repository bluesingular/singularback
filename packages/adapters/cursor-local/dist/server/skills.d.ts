import type { AdapterSkillContext, AdapterSkillSnapshot } from "@paperclipai/adapter-utils";
export declare function listCursorSkills(ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot>;
export declare function syncCursorSkills(ctx: AdapterSkillContext, desiredSkills: string[]): Promise<AdapterSkillSnapshot>;
export declare function resolveCursorDesiredSkillNames(config: Record<string, unknown>, availableEntries: Array<{
    key: string;
    required?: boolean;
}>): string[];
//# sourceMappingURL=skills.d.ts.map