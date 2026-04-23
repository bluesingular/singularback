"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Primitive } from "../../utils/Primitive.js";
import { forwardRef, } from "react";
import { useAuiState } from "@assistant-ui/store";
/**
 * Renders the prompt text of a queue item.
 *
 * @example
 * ```tsx
 * <QueueItemPrimitive.Text />
 * ```
 */
export const QueueItemPrimitiveText = forwardRef((props, ref) => {
    const prompt = useAuiState((s) => s.queueItem.prompt);
    return (_jsx(Primitive.span, { ...props, ref: ref, children: props.children ?? prompt }));
});
QueueItemPrimitiveText.displayName = "QueueItemPrimitive.Text";
//# sourceMappingURL=QueueItemText.js.map