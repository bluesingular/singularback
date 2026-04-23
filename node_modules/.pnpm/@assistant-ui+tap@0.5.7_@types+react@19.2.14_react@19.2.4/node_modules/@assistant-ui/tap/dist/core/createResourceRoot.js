import { createResourceFiber, unmountResourceFiber, renderResourceFiber, commitResourceFiber, } from "./ResourceFiber.js";
import { tapResourceRoot } from "../tapResourceRoot.js";
import { resource } from "./resource.js";
import { isDevelopment } from "./helpers/env.js";
import { flushResourcesSync, UpdateScheduler } from "./scheduler.js";
import { createResourceFiberRoot } from "./helpers/root.js";
const SubscribableResource = resource(tapResourceRoot);
export const createResourceRoot = () => {
    const fiber = createResourceFiber(SubscribableResource, createResourceFiberRoot((callback) => {
        new UpdateScheduler(() => {
            if (callback()) {
                throw new Error("Unexpected rerender of createResourceRoot outer fiber");
            }
            return false;
        }).markDirty();
    }), undefined, isDevelopment ? "root" : null);
    return {
        render: (element) => {
            // In strict mode, render twice to detect side effects
            if (isDevelopment && fiber.devStrictMode === "root") {
                void renderResourceFiber(fiber, element);
            }
            const render = renderResourceFiber(fiber, element);
            flushResourcesSync(() => commitResourceFiber(fiber, render));
            return render.output;
        },
        unmount: () => {
            unmountResourceFiber(fiber);
        },
    };
};
//# sourceMappingURL=createResourceRoot.js.map