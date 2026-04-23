import type { QuoteInfo } from "../../types/quote.js";
type MessageQuoteState = {
    message: {
        metadata?: unknown;
    };
};
export declare const getMessageQuote: (state: MessageQuoteState) => QuoteInfo | undefined;
export {};
//# sourceMappingURL=getMessageQuote.d.ts.map