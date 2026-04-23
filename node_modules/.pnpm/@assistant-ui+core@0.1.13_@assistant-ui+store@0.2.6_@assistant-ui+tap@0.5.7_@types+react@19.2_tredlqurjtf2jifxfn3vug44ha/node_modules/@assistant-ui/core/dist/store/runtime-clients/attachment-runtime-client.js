import { resource } from "@assistant-ui/tap";
import { tapSubscribable } from "./tap-subscribable.js";
export const AttachmentRuntimeClient = resource(({ runtime }) => {
    const state = tapSubscribable(runtime);
    return {
        getState: () => state,
        remove: runtime.remove,
        __internal_getRuntime: () => runtime,
    };
});
//# sourceMappingURL=attachment-runtime-client.js.map