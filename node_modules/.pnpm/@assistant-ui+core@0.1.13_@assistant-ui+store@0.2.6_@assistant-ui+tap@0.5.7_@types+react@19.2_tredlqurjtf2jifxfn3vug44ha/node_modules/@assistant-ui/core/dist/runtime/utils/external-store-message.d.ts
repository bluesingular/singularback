import type { ThreadMessage } from "../../types/message.js";
export declare const symbolInnerMessage: unique symbol;
/**
 * @deprecated Use `getExternalStoreMessages` (plural) instead. This function will be removed in 0.12.0.
 */
export declare const getExternalStoreMessage: <T>(input: ThreadMessage) => T | T[] | undefined;
/**
 * Attach the original external store message(s) to a ThreadMessage or message part.
 * This is a no-op if the target already has a bound message.
 * Use `getExternalStoreMessages` to retrieve the bound messages later.
 *
 * @deprecated This API is experimental and may change without notice.
 */
export declare const bindExternalStoreMessage: <T>(target: object, message: T | T[]) => void;
export declare const getExternalStoreMessages: <T>(input: {
    messages: readonly ThreadMessage[];
} | ThreadMessage | ThreadMessage["content"][number]) => T[];
//# sourceMappingURL=external-store-message.d.ts.map