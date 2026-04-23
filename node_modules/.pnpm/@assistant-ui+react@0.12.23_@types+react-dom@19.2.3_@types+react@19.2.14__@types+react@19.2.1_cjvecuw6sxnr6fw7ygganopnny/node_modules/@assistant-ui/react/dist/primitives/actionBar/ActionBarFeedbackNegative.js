"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from "react";
import { composeEventHandlers } from "@radix-ui/primitive";
import { Primitive } from "../../utils/Primitive.js";
import { useAuiState } from "@assistant-ui/store";
import { useActionBarFeedbackNegative as useActionBarFeedbackNegativeBehavior } from "@assistant-ui/core/react";
const useActionBarFeedbackNegative = () => {
    const { submit } = useActionBarFeedbackNegativeBehavior();
    return submit;
};
export const ActionBarPrimitiveFeedbackNegative = forwardRef(({ onClick, disabled, ...props }, forwardedRef) => {
    const isSubmitted = useAuiState((s) => s.message.metadata.submittedFeedback?.type === "negative");
    const callback = useActionBarFeedbackNegative();
    return (_jsx(Primitive.button, { type: "button", ...(isSubmitted ? { "data-submitted": "true" } : {}), ...props, ref: forwardedRef, disabled: disabled || !callback, onClick: composeEventHandlers(onClick, () => {
            callback?.();
        }) }));
});
ActionBarPrimitiveFeedbackNegative.displayName =
    "ActionBarPrimitive.FeedbackNegative";
//# sourceMappingURL=ActionBarFeedbackNegative.js.map