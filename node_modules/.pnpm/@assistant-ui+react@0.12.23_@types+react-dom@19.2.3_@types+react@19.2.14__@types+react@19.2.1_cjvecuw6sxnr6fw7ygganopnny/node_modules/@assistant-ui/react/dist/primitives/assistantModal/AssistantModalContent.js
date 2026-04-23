"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { usePopoverScope } from "./scope.js";
import { composeEventHandlers } from "@radix-ui/primitive";
export const AssistantModalPrimitiveContent = forwardRef(({ __scopeAssistantModal, side, align, onInteractOutside, dissmissOnInteractOutside = false, portalProps, ...props }, forwardedRef) => {
    const scope = usePopoverScope(__scopeAssistantModal);
    return (_jsx(PopoverPrimitive.Portal, { ...scope, ...portalProps, children: _jsx(PopoverPrimitive.Content, { ...scope, ...props, ref: forwardedRef, side: side ?? "top", align: align ?? "end", onInteractOutside: composeEventHandlers(onInteractOutside, dissmissOnInteractOutside ? undefined : (e) => e.preventDefault()) }) }));
});
AssistantModalPrimitiveContent.displayName = "AssistantModalPrimitive.Content";
//# sourceMappingURL=AssistantModalContent.js.map