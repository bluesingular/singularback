import { jsx as _jsx } from "react/jsx-runtime";
import { memo, useMemo } from "react";
import { RenderChildrenWithAccessor, useAuiState } from "@assistant-ui/store";
import { QueueItemByIndexProvider } from "../../providers/QueueItemByIndexProvider.js";
const ComposerPrimitiveQueueInner = ({ children }) => {
    const queue = useAuiState((s) => s.composer.queue.length);
    return useMemo(() => Array.from({ length: queue }, (_, index) => (_jsx(QueueItemByIndexProvider, { index: index, children: _jsx(RenderChildrenWithAccessor, { getItemState: (aui) => aui.composer().queueItem({ index }).getState(), children: (getItem) => children({
                get queueItem() {
                    return getItem();
                },
            }) }) }, index))), [queue, children]);
};
/**
 * Renders all queue items in the composer.
 *
 * @example
 * ```tsx
 * <ComposerPrimitive.Queue>
 *   {({ queueItem }) => (
 *     <div>
 *       <QueueItemPrimitive.Text />
 *       <QueueItemPrimitive.Steer>Run Now</QueueItemPrimitive.Steer>
 *     </div>
 *   )}
 * </ComposerPrimitive.Queue>
 * ```
 */
export const ComposerPrimitiveQueue = memo(ComposerPrimitiveQueueInner);
ComposerPrimitiveQueue.displayName = "ComposerPrimitive.Queue";
//# sourceMappingURL=ComposerQueue.js.map