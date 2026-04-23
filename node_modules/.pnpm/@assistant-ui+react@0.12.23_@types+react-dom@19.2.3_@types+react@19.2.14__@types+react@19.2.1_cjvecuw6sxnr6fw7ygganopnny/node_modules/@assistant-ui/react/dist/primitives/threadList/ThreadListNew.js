"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from "react";
import { Primitive } from "../../utils/Primitive.js";
import { composeEventHandlers } from "@radix-ui/primitive";
import { useAuiState } from "@assistant-ui/store";
import { useThreadListNew as useThreadListNewBehavior } from "@assistant-ui/core/react";
export const ThreadListPrimitiveNew = forwardRef(({ onClick, disabled, ...props }, forwardedRef) => {
    const isMain = useAuiState((s) => s.threads.newThreadId === s.threads.mainThreadId);
    const { switchToNewThread } = useThreadListNewBehavior();
    return (_jsx(Primitive.button, { type: "button", ...(isMain ? { "data-active": "true", "aria-current": "true" } : null), ...props, ref: forwardedRef, disabled: disabled, onClick: composeEventHandlers(onClick, switchToNewThread) }));
});
ThreadListPrimitiveNew.displayName = "ThreadListPrimitive.New";
//# sourceMappingURL=ThreadListNew.js.map