import { CompositeContextProvider } from "../../utils/composite-context-provider.js";
export class BaseAssistantRuntimeCore {
    _contextProvider = new CompositeContextProvider();
    registerModelContextProvider(provider) {
        return this._contextProvider.registerModelContextProvider(provider);
    }
    getModelContextProvider() {
        return this._contextProvider;
    }
}
//# sourceMappingURL=base-assistant-runtime-core.js.map