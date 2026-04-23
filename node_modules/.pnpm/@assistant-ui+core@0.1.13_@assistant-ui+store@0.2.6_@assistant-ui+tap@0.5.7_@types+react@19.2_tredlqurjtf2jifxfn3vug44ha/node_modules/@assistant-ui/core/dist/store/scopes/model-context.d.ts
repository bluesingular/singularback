import type { Unsubscribe } from "../../types/unsubscribe.js";
import type { ModelContextProvider } from "../../model-context/types.js";
export type ModelContextState = Record<string, never>;
export type ModelContextMethods = ModelContextProvider & {
    getState(): ModelContextState;
    register: (provider: ModelContextProvider) => Unsubscribe;
};
export type ModelContextClientSchema = {
    methods: ModelContextMethods;
};
//# sourceMappingURL=model-context.d.ts.map