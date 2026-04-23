"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from "react";
import { composeEventHandlers } from "@radix-ui/primitive";
import { useAuiState } from "@assistant-ui/store";
import { Primitive } from "../../utils/Primitive.js";
import { useActionBarFeedbackPositive as useActionBarFeedbackPositiveBehavior } from "@assistant-ui/core/react";
const useActionBarFeedbackPositive = () => {
    const { submit } = useActionBarFeedbackPositiveBehavior();
    return submit;
};
export const ActionBarPrimitiveFeedbackPositive = forwardRef(({ onClick, disabled, ...props }, forwardedRef) => {
    const isSubmitted = useAuiState((s) => s.message.metadata.submittedFeedback?.type === "positive");
    const callback = useActionBarFeedbackPositive();
    return (_jsx(Primitive.button, { type: "button", ...(isSubmitted ? { "data-submitted": "true" } : {}), ...props, ref: forwardedRef, disabled: disabled || !callback, onClick: composeEventHandlers(onClick, () => {
            callback?.();
        }) }));
});
ActionBarPrimitiveFeedbackPositive.displayName =
    "ActionBarPrimitive.FeedbackPositive";
//# sourceMappingURL=ActionBarFeedbackPositive.js.map