import { commitResourceFiber, createResourceFiber, renderResourceFiber, unmountResourceFiber, } from "./core/ResourceFiber.js";
import { UpdateScheduler } from "./core/scheduler.js";
import { tapConst } from "./hooks/tap-const.js";
import { tapMemo } from "./hooks/tap-memo.js";
import { tapEffect } from "./hooks/tap-effect.js";
import { tapEffectEvent } from "./hooks/tap-effect-event.js";
import { tapRef } from "./hooks/tap-ref.js";
import { isDevelopment } from "./core/helpers/env.js";
import { commitRoot, createResourceFiberRoot, setRootVersion, } from "./core/helpers/root.js";
// currently we never reset the root, because rollbakcs are not supported in tapResourceRoot
export const tapResourceRoot = (element) => {
    const scheduler = tapConst(() => new UpdateScheduler(() => handleUpdate(null)), []);
    const queue = tapConst(() => [], []);
    const fiber = tapMemo(() => {
        void element.key;
        return createResourceFiber(element.type, createResourceFiberRoot((callback) => {
            if (!scheduler.isDirty && !callback())
                return;
            queue.push(callback);
            scheduler.markDirty();
        }));
    }, [element.type, element.key]);
    setRootVersion(fiber.root, fiber.root.committedVersion);
    const render = renderResourceFiber(fiber, element.props);
    const isMountedRef = tapRef(false);
    const committedPropsRef = tapRef(element.props);
    const valueRef = tapRef(render.output);
    const subscribers = tapConst(() => new Set(), []);
    const handleUpdate = tapEffectEvent((render) => {
        if (render === null) {
            setRootVersion(fiber.root, 2);
            setRootVersion(fiber.root, 1);
            queue.forEach((callback) => {
                if (isDevelopment && fiber.devStrictMode) {
                    callback();
                }
                callback();
            });
            if (isDevelopment && fiber.devStrictMode) {
                void renderResourceFiber(fiber, committedPropsRef.current);
            }
            render = renderResourceFiber(fiber, committedPropsRef.current);
        }
        if (scheduler.isDirty)
            throw new Error("Scheduler is dirty, this should never happen");
        commitRoot(fiber.root);
        queue.length = 0;
        if (isMountedRef.current) {
            commitResourceFiber(fiber, render);
        }
        if (scheduler.isDirty || valueRef.current === render.output)
            return;
        valueRef.current = render.output;
        subscribers.forEach((callback) => callback());
    });
    tapEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            unmountResourceFiber(fiber);
        };
    }, [fiber]);
    tapEffect(() => {
        committedPropsRef.current = render.props;
        commitRoot(fiber.root);
        commitResourceFiber(fiber, render);
        if (scheduler.isDirty || valueRef.current === render.output)
            return;
        valueRef.current = render.output;
        subscribers.forEach((callback) => callback());
    });
    return tapMemo(() => ({
        getValue: () => valueRef.current,
        subscribe: (listener) => {
            subscribers.add(listener);
            return () => subscribers.delete(listener);
        },
    }), []);
};
//# sourceMappingURL=tapResourceRoot.js.map