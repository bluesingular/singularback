import type { AdapterSkillContext, AdapterSkillSnapshot } from "@paperclipai/adapter-utils";
export declare function listPiSkills(ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot>;
export declare function syncPiSkills(ctx: AdapterSkillContext, desiredSkills: string[]): Promise<AdapterSkillSnapshot>;
export declare function resolvePiDesiredSkillNames(config: Record<string, unknown>, availableEntries: Array<{
    key: string;
    required?: boolean;
}>): string[];
//# sourceMappingURL=skills.d.ts.map