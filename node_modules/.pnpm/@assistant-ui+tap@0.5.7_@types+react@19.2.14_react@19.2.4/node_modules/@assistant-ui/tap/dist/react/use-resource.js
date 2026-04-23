import { useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { createResourceFiber, unmountResourceFiber, renderResourceFiber, commitResourceFiber, } from "../core/ResourceFiber.js";
import { isDevelopment } from "../core/helpers/env.js";
import { commitRoot, createResourceFiberRoot, setRootVersion, } from "../core/helpers/root.js";
const useDevStrictMode = () => {
    if (!isDevelopment)
        return null;
    const count = useRef(0);
    const isFirstRender = count.current === 0;
    useState(() => count.current++);
    if (count.current !== 2)
        return null;
    return isFirstRender ? "child" : "root";
};
export function useResource(element) {
    const root = useMemo(() => {
        return createResourceFiberRoot((cb) => dispatch(cb));
    }, []);
    const [version, dispatch] = useReducer((v, cb) => {
        setRootVersion(root, v);
        return v + (cb() ? 1 : 0);
    }, 0);
    setRootVersion(root, version);
    const devStrictMode = useDevStrictMode();
    const fiber = useMemo(() => {
        void element.key;
        return createResourceFiber(element.type, root, undefined, devStrictMode);
    }, [element.type, element.key, root, devStrictMode]);
    const result = renderResourceFiber(fiber, element.props);
    useLayoutEffect(() => {
        return () => unmountResourceFiber(fiber);
    }, [fiber]);
    useLayoutEffect(() => {
        commitRoot(root);
        commitResourceFiber(fiber, result);
    });
    return result.output;
}
//# sourceMappingURL=use-resource.js.map