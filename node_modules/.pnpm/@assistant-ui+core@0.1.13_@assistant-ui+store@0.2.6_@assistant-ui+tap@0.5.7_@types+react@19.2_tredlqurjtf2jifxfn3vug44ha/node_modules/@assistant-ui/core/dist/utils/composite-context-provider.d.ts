import { type ModelContextProvider } from "../model-context/types.js";
export declare class CompositeContextProvider implements ModelContextProvider {
    private _providers;
    getModelContext(): import("..").ModelContext;
    registerModelContextProvider(provider: ModelContextProvider): () => void;
    private _subscribers;
    notifySubscribers(): void;
    subscribe(callback: () => void): () => boolean;
}
//# sourceMappingURL=composite-context-provider.d.ts.map