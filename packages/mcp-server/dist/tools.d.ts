import { z } from "zod";
import { PaperclipApiClient } from "./client.js";
export interface ToolDefinition {
    name: string;
    description: string;
    schema: z.AnyZodObject;
    execute: (input: Record<string, unknown>) => Promise<{
        content: Array<{
            type: "text";
            text: string;
        }>;
    }>;
}
export declare function createToolDefinitions(client: PaperclipApiClient): ToolDefinition[];
//# sourceMappingURL=tools.d.ts.map