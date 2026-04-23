export const symbolInnerMessage = Symbol("innerMessage");
const symbolInnerMessages = Symbol("innerMessages");
/**
 * @deprecated Use `getExternalStoreMessages` (plural) instead. This function will be removed in 0.12.0.
 */
export const getExternalStoreMessage = (input) => {
    const withInnerMessages = input;
    return withInnerMessages[symbolInnerMessage];
};
const EMPTY_ARRAY = [];
/**
 * Attach the original external store message(s) to a ThreadMessage or message part.
 * This is a no-op if the target already has a bound message.
 * Use `getExternalStoreMessages` to retrieve the bound messages later.
 *
 * @deprecated This API is experimental and may change without notice.
 */
export const bindExternalStoreMessage = (target, message) => {
    if (symbolInnerMessage in target)
        return;
    target[symbolInnerMessage] = message;
};
export const getExternalStoreMessages = (input) => {
    const container = ("messages" in input ? input.messages : input);
    const value = container[symbolInnerMessages] || container[symbolInnerMessage];
    if (!value)
        return EMPTY_ARRAY;
    if (Array.isArray(value)) {
        return value;
    }
    container[symbolInnerMessages] = [value];
    return container[symbolInnerMessages];
};
//# sourceMappingURL=external-store-message.js.map