export const getMessageQuote = (state) => {
    const metadata = state.message.metadata;
    if (!metadata || typeof metadata !== "object")
        return undefined;
    return metadata.custom?.quote;
};
//# sourceMappingURL=getMessageQuote.js.map