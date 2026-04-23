"use client";
import { useMessageError } from "@assistant-ui/core/react";
export const MessagePrimitiveError = ({ children }) => {
    const error = useMessageError();
    return error !== undefined ? children : null;
};
MessagePrimitiveError.displayName = "MessagePrimitive.Error";
//# sourceMappingURL=MessageError.js.map