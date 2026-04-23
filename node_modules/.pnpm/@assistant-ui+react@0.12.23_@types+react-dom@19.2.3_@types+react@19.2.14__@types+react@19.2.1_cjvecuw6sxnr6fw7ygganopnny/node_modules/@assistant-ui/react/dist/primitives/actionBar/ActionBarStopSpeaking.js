"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from "react";
import { useEscapeKeydown } from "@radix-ui/react-use-escape-keydown";
import { Primitive } from "../../utils/Primitive.js";
import { composeEventHandlers } from "@radix-ui/primitive";
import { useActionBarStopSpeaking as useActionBarStopSpeakingBehavior } from "@assistant-ui/core/react";
const useActionBarStopSpeaking = () => {
    const { disabled, stopSpeaking } = useActionBarStopSpeakingBehavior();
    if (disabled)
        return null;
    return stopSpeaking;
};
export const ActionBarPrimitiveStopSpeaking = forwardRef((props, ref) => {
    const callback = useActionBarStopSpeaking();
    // TODO this stops working if the user is not hovering over an older message
    useEscapeKeydown((e) => {
        if (callback) {
            e.preventDefault();
            callback();
        }
    });
    return (_jsx(Primitive.button, { type: "button", disabled: !callback, ...props, ref: ref, onClick: composeEventHandlers(props.onClick, () => {
            callback?.();
        }) }));
});
ActionBarPrimitiveStopSpeaking.displayName = "ActionBarPrimitive.StopSpeaking";
//# sourceMappingURL=ActionBarStopSpeaking.js.map