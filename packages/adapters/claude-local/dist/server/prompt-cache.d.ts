import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { type PaperclipSkillEntry } from "@paperclipai/adapter-utils/server-utils";
type SkillEntry = PaperclipSkillEntry;
export interface ClaudePromptBundle {
    bundleKey: string;
    rootDir: string;
    addDir: string;
    instructionsFilePath: string | null;
}
export declare function prepareClaudePromptBundle(input: {
    companyId: string;
    skills: SkillEntry[];
    instructionsContents: string | null;
    onLog: AdapterExecutionContext["onLog"];
}): Promise<ClaudePromptBundle>;
export {};
//# sourceMappingURL=prompt-cache.d.ts.map