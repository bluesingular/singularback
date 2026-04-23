import { isDevelopment } from "../core/helpers/env.js";
import { getCurrentResourceFiber } from "../core/helpers/execution-context.js";
import { tapReducerWithDerivedState } from "./tap-reducer.js";
import { depsShallowEqual } from "./utils/depsShallowEqual.js";
const memoReducer = () => {
    throw new Error("Memo reducer should not be called");
};
export const tapMemo = (fn, deps) => {
    const fiber = getCurrentResourceFiber();
    const [state] = tapReducerWithDerivedState(memoReducer, (state) => {
        if (state && depsShallowEqual(state.deps, deps))
            return state;
        const value = fn();
        if (isDevelopment && fiber.devStrictMode) {
            void fn();
        }
        return { value, deps };
    }, null);
    return state.value;
};
//# sourceMappingURL=tap-memo.js.map