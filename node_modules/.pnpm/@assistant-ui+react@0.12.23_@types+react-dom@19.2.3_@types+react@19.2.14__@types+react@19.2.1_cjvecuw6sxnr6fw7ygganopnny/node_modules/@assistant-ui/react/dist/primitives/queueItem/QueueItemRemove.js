"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useAui } from "@assistant-ui/store";
import { useCallback } from "react";
const useQueueItemRemove = () => {
    const aui = useAui();
    const callback = useCallback(() => {
        aui.queueItem().remove();
    }, [aui]);
    return callback;
};
/**
 * A button that removes this item from the queue.
 *
 * @example
 * ```tsx
 * <QueueItemPrimitive.Remove>×</QueueItemPrimitive.Remove>
 * ```
 */
export const QueueItemPrimitiveRemove = createActionButton("QueueItemPrimitive.Remove", useQueueItemRemove);
//# sourceMappingURL=QueueItemRemove.js.map