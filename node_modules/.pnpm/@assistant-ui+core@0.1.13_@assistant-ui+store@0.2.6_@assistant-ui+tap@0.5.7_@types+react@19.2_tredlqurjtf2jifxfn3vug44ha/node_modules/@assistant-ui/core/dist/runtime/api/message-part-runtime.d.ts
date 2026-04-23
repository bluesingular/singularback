import type { ThreadAssistantMessagePart, ThreadUserMessagePart, ToolCallMessagePartStatus } from "../../types/message.js";
import type { Unsubscribe } from "../../types/unsubscribe.js";
import type { MessagePartStatus } from "../../types/message.js";
import type { SubscribableWithState } from "../../subscribable/subscribable.js";
import type { ThreadRuntimeCoreBinding } from "./thread-runtime.js";
import type { MessageStateBinding } from "./bindings.js";
import type { MessagePartRuntimePath } from "./paths.js";
import { ToolResponse } from "assistant-stream";
export type MessagePartState = (ThreadUserMessagePart | ThreadAssistantMessagePart) & {
    readonly status: MessagePartStatus | ToolCallMessagePartStatus;
};
type MessagePartSnapshotBinding = SubscribableWithState<MessagePartState, MessagePartRuntimePath>;
export type MessagePartRuntime = {
    addToolResult(result: any | ToolResponse<any>): void;
    resumeToolCall(payload: unknown): void;
    readonly path: MessagePartRuntimePath;
    getState(): MessagePartState;
    subscribe(callback: () => void): Unsubscribe;
};
export declare class MessagePartRuntimeImpl implements MessagePartRuntime {
    private contentBinding;
    private messageApi?;
    private threadApi?;
    get path(): MessagePartRuntimePath;
    constructor(contentBinding: MessagePartSnapshotBinding, messageApi?: MessageStateBinding | undefined, threadApi?: ThreadRuntimeCoreBinding | undefined);
    protected __internal_bindMethods(): void;
    getState(): MessagePartState;
    addToolResult(result: any | ToolResponse<any>): void;
    resumeToolCall(payload: unknown): void;
    subscribe(callback: () => void): Unsubscribe;
}
export {};
//# sourceMappingURL=message-part-runtime.d.ts.map