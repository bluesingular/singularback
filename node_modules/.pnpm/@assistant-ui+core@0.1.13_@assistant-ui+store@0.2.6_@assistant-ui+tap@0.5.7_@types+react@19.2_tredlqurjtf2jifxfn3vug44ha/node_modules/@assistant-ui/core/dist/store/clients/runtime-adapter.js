import { resource, tapEffect, tapResource } from "@assistant-ui/tap";
import { ThreadListClient } from "../runtime-clients/thread-list-runtime-client.js";
import { tapAssistantClientRef, Derived, } from "@assistant-ui/store";
import { ModelContext } from "./model-context-client.js";
import { Suggestions } from "./suggestions.js";
export const RuntimeAdapterResource = resource((runtime) => {
    const clientRef = tapAssistantClientRef();
    tapEffect(() => {
        return runtime.registerModelContextProvider(clientRef.current.modelContext());
    }, [runtime, clientRef]);
    return tapResource(ThreadListClient({
        runtime: runtime.threads,
        __internal_assistantRuntime: runtime,
    }));
});
export const baseRuntimeAdapterTransformScopes = (scopes, parent) => {
    scopes.thread ??= Derived({
        source: "threads",
        query: { type: "main" },
        get: (aui) => aui.threads().thread("main"),
    });
    scopes.threadListItem ??= Derived({
        source: "threads",
        query: { type: "main" },
        get: (aui) => aui.threads().item("main"),
    });
    scopes.composer ??= Derived({
        source: "thread",
        query: {},
        get: (aui) => aui.threads().thread("main").composer(),
    });
    if (!scopes.modelContext && parent.modelContext.source === null) {
        scopes.modelContext = ModelContext();
    }
    if (!scopes.suggestions && parent.suggestions.source === null) {
        scopes.suggestions = Suggestions();
    }
};
//# sourceMappingURL=runtime-adapter.js.map