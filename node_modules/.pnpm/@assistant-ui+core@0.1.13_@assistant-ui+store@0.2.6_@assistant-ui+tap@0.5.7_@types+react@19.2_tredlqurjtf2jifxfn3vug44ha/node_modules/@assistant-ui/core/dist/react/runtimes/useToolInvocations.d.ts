import { type Tool } from "assistant-stream";
import { type ReadonlyJSONValue } from "assistant-stream/utils";
import type { ThreadMessage } from "../../types/message.js";
export type AssistantTransportState = {
    readonly messages: readonly ThreadMessage[];
    readonly state?: ReadonlyJSONValue;
    readonly isRunning: boolean;
};
export type AddToolResultCommand = {
    readonly type: "add-tool-result";
    readonly toolCallId: string;
    readonly toolName: string;
    readonly result: ReadonlyJSONValue;
    readonly isError: boolean;
    readonly artifact?: ReadonlyJSONValue;
};
type UseToolInvocationsParams = {
    state: AssistantTransportState;
    getTools: () => Record<string, Tool> | undefined;
    onResult: (command: AddToolResultCommand) => void;
    setToolStatuses: (updater: Record<string, ToolExecutionStatus> | ((prev: Record<string, ToolExecutionStatus>) => Record<string, ToolExecutionStatus>)) => void;
};
export type ToolExecutionStatus = {
    type: "executing";
} | {
    type: "interrupt";
    payload: {
        type: "human";
        payload: unknown;
    };
};
export declare function useToolInvocations({ state, getTools, onResult, setToolStatuses, }: UseToolInvocationsParams): {
    reset: () => void;
    abort: () => Promise<void>;
    resume: (toolCallId: string, payload: unknown) => void;
};
export {};
//# sourceMappingURL=useToolInvocations.d.ts.map