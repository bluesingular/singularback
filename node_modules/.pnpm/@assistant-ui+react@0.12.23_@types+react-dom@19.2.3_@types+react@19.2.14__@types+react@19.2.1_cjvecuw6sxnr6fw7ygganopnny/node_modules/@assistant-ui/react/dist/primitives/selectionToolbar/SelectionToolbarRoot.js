"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Primitive } from "../../utils/Primitive.js";
import { createContext, forwardRef, useContext, useEffect, useState, } from "react";
import { createPortal } from "react-dom";
import { getSelectionMessageId } from "../../utils/getSelectionMessageId.js";
const SelectionToolbarContext = createContext(null);
export const useSelectionToolbarInfo = () => useContext(SelectionToolbarContext);
/**
 * A floating toolbar that appears when text is selected within a message.
 *
 * Listens for mouse and keyboard selection events, validates that the
 * selection is within a single message, and renders a positioned portal
 * near the selection. Prevents mousedown from clearing the selection.
 *
 * @example
 * ```tsx
 * <SelectionToolbarPrimitive.Root>
 *   <SelectionToolbarPrimitive.Quote>Quote</SelectionToolbarPrimitive.Quote>
 * </SelectionToolbarPrimitive.Root>
 * ```
 */
export const SelectionToolbarPrimitiveRoot = forwardRef(({ onMouseDown, style, ...props }, forwardedRef) => {
    const [info, setInfo] = useState(null);
    useEffect(() => {
        const checkSelection = () => {
            requestAnimationFrame(() => {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed) {
                    setInfo(null);
                    return;
                }
                const text = sel.toString().trim();
                if (!text) {
                    setInfo(null);
                    return;
                }
                const messageId = getSelectionMessageId(sel);
                if (!messageId) {
                    setInfo(null);
                    return;
                }
                const range = sel.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setInfo({ text, messageId, rect });
            });
        };
        const handleSelectionCollapse = () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed) {
                setInfo(null);
            }
        };
        const handleScroll = () => {
            setInfo(null);
        };
        document.addEventListener("mouseup", checkSelection);
        document.addEventListener("keyup", checkSelection);
        document.addEventListener("selectionchange", handleSelectionCollapse);
        document.addEventListener("scroll", handleScroll, true);
        return () => {
            document.removeEventListener("mouseup", checkSelection);
            document.removeEventListener("keyup", checkSelection);
            document.removeEventListener("selectionchange", handleSelectionCollapse);
            document.removeEventListener("scroll", handleScroll, true);
        };
    }, []);
    if (!info)
        return null;
    const positionStyle = {
        position: "fixed",
        top: `${info.rect.top - 8}px`,
        left: `${info.rect.left + info.rect.width / 2}px`,
        transform: "translate(-50%, -100%)",
        zIndex: 50,
        ...style,
    };
    return createPortal(_jsx(SelectionToolbarContext.Provider, { value: info, children: _jsx(Primitive.div, { ...props, ref: forwardedRef, style: positionStyle, onMouseDown: (e) => {
                // Prevent mousedown from clearing the text selection
                e.preventDefault();
                onMouseDown?.(e);
            } }) }), document.body);
});
SelectionToolbarPrimitiveRoot.displayName = "SelectionToolbarPrimitive.Root";
//# sourceMappingURL=SelectionToolbarRoot.js.map