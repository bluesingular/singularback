import type { ToolCallMessagePartComponent } from "../MessagePartComponentTypes.js";
import type { Unsubscribe } from "../../../index.js";
export type ToolsState = {
    tools: Record<string, ToolCallMessagePartComponent[]>;
};
export type ToolsMethods = {
    getState(): ToolsState;
    setToolUI(toolName: string, render: ToolCallMessagePartComponent): Unsubscribe;
};
export type ToolsClientSchema = {
    methods: ToolsMethods;
};
//# sourceMappingURL=tools.d.ts.map