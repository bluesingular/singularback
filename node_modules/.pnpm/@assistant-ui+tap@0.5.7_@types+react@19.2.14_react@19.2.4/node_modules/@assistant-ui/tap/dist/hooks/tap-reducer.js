import { isDevelopment } from "../core/helpers/env.js";
import { getCurrentResourceFiber } from "../core/helpers/execution-context.js";
import { markCellDirty } from "../core/helpers/root.js";
import { tapHook } from "./utils/tapHook.js";
const dispatchOnFiber = (fiber, callback) => {
    if (fiber.renderContext) {
        throw new Error("Resource updated during render");
    }
    if (fiber.isNeverMounted) {
        throw new Error("Resource updated before mount");
    }
    fiber.root.dispatchUpdate(() => {
        const result = callback();
        if (result) {
            result();
            fiber.root.changelog.push(result);
            return true;
        }
        return false;
    });
};
function tapReducerImpl(reducer, getDerivedState, initialArg, initFn) {
    const cell = tapHook("reducer", () => {
        const fiber = getCurrentResourceFiber();
        // First render: compute initial state
        const initialState = initFn ? initFn(initialArg) : initialArg;
        if (isDevelopment && fiber.devStrictMode && initFn) {
            void initFn(initialArg);
        }
        return {
            type: "reducer",
            queue: new Set(),
            dirty: false,
            workInProgress: initialState,
            current: initialState,
            reducer,
            dispatch: (action) => {
                const entry = {
                    action,
                    hasEagerState: false,
                    eagerState: undefined,
                };
                dispatchOnFiber(fiber, () => {
                    if (fiber.root.dirtyCells.length === 0 && !entry.hasEagerState) {
                        entry.eagerState = reducer(cell.workInProgress, action);
                        entry.hasEagerState = true;
                        if (Object.is(cell.current, entry.eagerState))
                            return null;
                    }
                    return () => {
                        markCellDirty(fiber, cell);
                        cell.queue.add(entry);
                    };
                });
            },
        };
    });
    const fiber = getCurrentResourceFiber();
    const sameReducer = reducer === cell.reducer;
    cell.reducer = reducer;
    for (const item of cell.queue) {
        if (!item.hasEagerState || !sameReducer) {
            item.eagerState = reducer(cell.workInProgress, item.action);
            item.hasEagerState = true;
        }
        if (isDevelopment && fiber.devStrictMode) {
            void reducer(cell.workInProgress, item.action);
        }
        cell.workInProgress = item.eagerState;
    }
    cell.queue.clear();
    if (getDerivedState) {
        const derived = getDerivedState(cell.workInProgress);
        if (!Object.is(derived, cell.workInProgress)) {
            markCellDirty(fiber, cell);
            cell.workInProgress = derived;
        }
    }
    return [cell.workInProgress, cell.dispatch];
}
export function tapReducer(reducer, initialArg, init) {
    return tapReducerImpl(reducer, undefined, initialArg, init);
}
export function tapReducerWithDerivedState(reducer, getDerivedState, initialArg, init) {
    return tapReducerImpl(reducer, getDerivedState, initialArg, init);
}
//# sourceMappingURL=tap-reducer.js.map