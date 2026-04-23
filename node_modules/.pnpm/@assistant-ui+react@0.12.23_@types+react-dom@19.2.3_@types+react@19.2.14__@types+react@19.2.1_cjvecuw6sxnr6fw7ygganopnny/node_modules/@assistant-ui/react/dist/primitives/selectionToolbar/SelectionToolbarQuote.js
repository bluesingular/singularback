"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Primitive } from "../../utils/Primitive.js";
import { composeEventHandlers } from "@radix-ui/primitive";
import { forwardRef, useCallback, } from "react";
import { useAui } from "@assistant-ui/store";
import { useSelectionToolbarInfo } from "./SelectionToolbarRoot.js";
/**
 * A button that quotes the currently selected text.
 *
 * Must be placed inside `SelectionToolbarPrimitive.Root`. Reads the
 * selection info from context (captured by the Root), sets it as a
 * quote in the thread composer, and clears the selection.
 *
 * @example
 * ```tsx
 * <SelectionToolbarPrimitive.Quote>
 *   <QuoteIcon /> Quote
 * </SelectionToolbarPrimitive.Quote>
 * ```
 */
export const SelectionToolbarPrimitiveQuote = forwardRef(({ onClick, disabled, ...props }, forwardedRef) => {
    const aui = useAui();
    const info = useSelectionToolbarInfo();
    const handleClick = useCallback(() => {
        if (!info)
            return;
        aui.thread().composer().setQuote({
            text: info.text,
            messageId: info.messageId,
        });
        window.getSelection()?.removeAllRanges();
    }, [aui, info]);
    return (_jsx(Primitive.button, { type: "button", ...props, ref: forwardedRef, disabled: disabled || !info, onClick: composeEventHandlers(onClick, handleClick) }));
});
SelectionToolbarPrimitiveQuote.displayName = "SelectionToolbarPrimitive.Quote";
//# sourceMappingURL=SelectionToolbarQuote.js.map