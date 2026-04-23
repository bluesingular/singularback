import { commitAllEffects, cleanupAllEffects } from "./helpers/commit.js";
import { getDevStrictMode, withResourceFiber, } from "./helpers/execution-context.js";
import { callResourceFn } from "./helpers/callResourceFn.js";
import { isDevelopment } from "./helpers/env.js";
export function createResourceFiber(type, root, markDirty = undefined, strictMode = getDevStrictMode(false)) {
    return {
        type,
        root,
        markDirty,
        devStrictMode: strictMode,
        cells: [],
        currentIndex: 0,
        renderContext: undefined,
        isFirstRender: true,
        isMounted: false,
        isNeverMounted: true,
    };
}
export function unmountResourceFiber(fiber) {
    if (!fiber.isMounted)
        throw new Error("Tried to unmount a fiber that is already unmounted");
    fiber.isMounted = false;
    cleanupAllEffects(fiber);
}
export function renderResourceFiber(fiber, props) {
    const result = {
        effectTasks: [],
        props,
        output: undefined,
    };
    withResourceFiber(fiber, () => {
        fiber.renderContext = result;
        try {
            result.output = callResourceFn(fiber.type, props);
        }
        finally {
            fiber.renderContext = undefined;
        }
    });
    return result;
}
export function commitResourceFiber(fiber, result) {
    fiber.isMounted = true;
    if (isDevelopment && fiber.isNeverMounted && fiber.devStrictMode === "root") {
        fiber.isNeverMounted = false;
        commitAllEffects(result);
        cleanupAllEffects(fiber);
    }
    fiber.isNeverMounted = false;
    commitAllEffects(result);
}
//# sourceMappingURL=ResourceFiber.js.map