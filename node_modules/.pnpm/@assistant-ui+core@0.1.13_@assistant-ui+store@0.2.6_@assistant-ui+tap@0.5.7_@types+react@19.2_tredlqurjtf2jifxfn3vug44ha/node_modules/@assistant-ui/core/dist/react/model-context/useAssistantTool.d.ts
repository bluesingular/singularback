import type { ToolCallMessagePartComponent } from "../types/MessagePartComponentTypes.js";
import type { AssistantToolProps as CoreAssistantToolProps } from "../../index.js";
export type AssistantToolProps<TArgs extends Record<string, unknown>, TResult> = CoreAssistantToolProps<TArgs, TResult> & {
    render?: ToolCallMessagePartComponent<TArgs, TResult> | undefined;
};
export declare const useAssistantTool: <TArgs extends Record<string, unknown>, TResult>(tool: AssistantToolProps<TArgs, TResult>) => void;
//# sourceMappingURL=useAssistantTool.d.ts.map