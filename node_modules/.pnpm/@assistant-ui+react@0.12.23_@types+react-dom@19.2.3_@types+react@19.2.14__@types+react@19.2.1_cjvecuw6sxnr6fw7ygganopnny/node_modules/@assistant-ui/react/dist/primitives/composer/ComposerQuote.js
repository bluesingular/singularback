"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Primitive } from "../../utils/Primitive.js";
import { forwardRef, useCallback, } from "react";
import { useAui, useAuiState } from "@assistant-ui/store";
import { composeEventHandlers } from "@radix-ui/primitive";
/**
 * Renders a container for the quoted text preview in the composer.
 * Only renders when a quote is set.
 *
 * @example
 * ```tsx
 * <ComposerPrimitive.Quote>
 *   <ComposerPrimitive.QuoteText />
 *   <ComposerPrimitive.QuoteDismiss>×</ComposerPrimitive.QuoteDismiss>
 * </ComposerPrimitive.Quote>
 * ```
 */
export const ComposerPrimitiveQuote = forwardRef((props, forwardedRef) => {
    const quote = useAuiState((s) => s.composer.quote);
    if (!quote)
        return null;
    return _jsx(Primitive.div, { ...props, ref: forwardedRef });
});
ComposerPrimitiveQuote.displayName = "ComposerPrimitive.Quote";
/**
 * Renders the quoted text content.
 *
 * @example
 * ```tsx
 * <ComposerPrimitive.QuoteText />
 * ```
 */
export const ComposerPrimitiveQuoteText = forwardRef(({ children, ...props }, forwardedRef) => {
    const text = useAuiState((s) => s.composer.quote?.text);
    if (!text)
        return null;
    return (_jsx(Primitive.span, { ...props, ref: forwardedRef, children: children ?? text }));
});
ComposerPrimitiveQuoteText.displayName = "ComposerPrimitive.QuoteText";
/**
 * A button that clears the current quote from the composer.
 *
 * @example
 * ```tsx
 * <ComposerPrimitive.QuoteDismiss>×</ComposerPrimitive.QuoteDismiss>
 * ```
 */
export const ComposerPrimitiveQuoteDismiss = forwardRef(({ onClick, ...props }, forwardedRef) => {
    const aui = useAui();
    const handleDismiss = useCallback(() => {
        aui.composer().setQuote(undefined);
    }, [aui]);
    return (_jsx(Primitive.button, { type: "button", ...props, ref: forwardedRef, onClick: composeEventHandlers(onClick, handleDismiss) }));
});
ComposerPrimitiveQuoteDismiss.displayName = "ComposerPrimitive.QuoteDismiss";
//# sourceMappingURL=ComposerQuote.js.map