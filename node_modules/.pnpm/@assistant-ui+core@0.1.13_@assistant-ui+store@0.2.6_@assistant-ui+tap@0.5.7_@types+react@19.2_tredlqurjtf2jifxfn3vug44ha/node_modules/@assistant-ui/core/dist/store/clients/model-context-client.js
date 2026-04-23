import { resource, tapMemo, tapState } from "@assistant-ui/tap";
import { CompositeContextProvider } from "../../utils/composite-context-provider.js";
const version = 1;
export const ModelContext = resource(() => {
    const [state] = tapState(() => ({ version: version + 1 }));
    const composite = tapMemo(() => new CompositeContextProvider(), []);
    return {
        getState: () => state,
        getModelContext: () => composite.getModelContext(),
        subscribe: (callback) => composite.subscribe(callback),
        register: (provider) => composite.registerModelContextProvider(provider),
    };
});
//# sourceMappingURL=model-context-client.js.map