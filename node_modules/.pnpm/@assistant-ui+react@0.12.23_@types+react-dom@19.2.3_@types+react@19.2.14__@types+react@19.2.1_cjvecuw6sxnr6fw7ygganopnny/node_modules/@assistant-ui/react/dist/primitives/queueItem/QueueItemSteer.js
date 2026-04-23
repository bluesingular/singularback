"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useAui } from "@assistant-ui/store";
import { useCallback } from "react";
const useQueueItemSteer = () => {
    const aui = useAui();
    const callback = useCallback(() => {
        aui.queueItem().steer();
    }, [aui]);
    return callback;
};
/**
 * A button that steers the current run to process this queue item immediately.
 *
 * @example
 * ```tsx
 * <QueueItemPrimitive.Steer>Run Now</QueueItemPrimitive.Steer>
 * ```
 */
export const QueueItemPrimitiveSteer = createActionButton("QueueItemPrimitive.Steer", useQueueItemSteer);
//# sourceMappingURL=QueueItemSteer.js.map