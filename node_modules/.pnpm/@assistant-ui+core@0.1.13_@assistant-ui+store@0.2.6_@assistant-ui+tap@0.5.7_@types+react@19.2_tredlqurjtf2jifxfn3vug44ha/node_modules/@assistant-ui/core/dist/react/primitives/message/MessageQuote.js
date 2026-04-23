import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { memo } from "react";
import { useAuiState } from "@assistant-ui/store";
import { getMessageQuote } from "../../utils/getMessageQuote.js";
/**
 * Renders a quote block if the message has quote metadata.
 * Place this above `MessagePrimitive.Parts` in your message layout.
 *
 * @example
 * ```tsx
 * <MessagePrimitive.Quote>
 *   {({ text, messageId }) => <QuoteBlock text={text} messageId={messageId} />}
 * </MessagePrimitive.Quote>
 * <MessagePrimitive.Parts>
 *   {({ part }) => { ... }}
 * </MessagePrimitive.Parts>
 * ```
 */
const MessagePrimitiveQuoteImpl = ({ children, }) => {
    const quoteInfo = useAuiState(getMessageQuote);
    if (!quoteInfo)
        return null;
    return _jsx(_Fragment, { children: children(quoteInfo) });
};
export const MessagePrimitiveQuote = memo(MessagePrimitiveQuoteImpl);
MessagePrimitiveQuote.displayName = "MessagePrimitive.Quote";
//# sourceMappingURL=MessageQuote.js.map