import { tapEffect } from "./tap-effect.js";
import { createResourceFiber, unmountResourceFiber, renderResourceFiber, commitResourceFiber, } from "../core/ResourceFiber.js";
import { tapMemo } from "./tap-memo.js";
import { tapRef } from "./tap-ref.js";
import { getCurrentResourceFiber } from "../core/helpers/execution-context.js";
export function tapResource(element, propsDeps) {
    const parentFiber = getCurrentResourceFiber();
    const versionRef = tapRef(0);
    const fiber = tapMemo(() => {
        void element.key;
        return createResourceFiber(element.type, parentFiber.root, () => {
            versionRef.current++;
            parentFiber.markDirty?.();
        });
    }, [element.type, element.key, parentFiber]);
    const result = propsDeps
        ? // biome-ignore lint/correctness/useExhaustiveDependencies: user provided deps instead of prop identity
            tapMemo(() => renderResourceFiber(fiber, element.props), [fiber, ...propsDeps, versionRef.current])
        : renderResourceFiber(fiber, element.props);
    tapEffect(() => () => unmountResourceFiber(fiber), [fiber]);
    tapEffect(() => {
        commitResourceFiber(fiber, result);
    }, [fiber, result]);
    return result.output;
}
//# sourceMappingURL=tap-resource.js.map