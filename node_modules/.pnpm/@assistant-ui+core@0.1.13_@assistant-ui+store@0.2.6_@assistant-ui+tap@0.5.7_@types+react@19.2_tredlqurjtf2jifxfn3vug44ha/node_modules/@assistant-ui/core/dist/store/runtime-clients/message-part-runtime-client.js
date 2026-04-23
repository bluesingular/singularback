import { resource } from "@assistant-ui/tap";
import { tapSubscribable } from "./tap-subscribable.js";
export const MessagePartClient = resource(({ runtime }) => {
    const state = tapSubscribable(runtime);
    return {
        getState: () => state,
        addToolResult: (result) => runtime.addToolResult(result),
        resumeToolCall: (payload) => runtime.resumeToolCall(payload),
        __internal_getRuntime: () => runtime,
    };
});
//# sourceMappingURL=message-part-runtime-client.js.map