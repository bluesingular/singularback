"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useActionBarSpeak as useActionBarSpeakBehavior } from "@assistant-ui/core/react";
const useActionBarSpeak = () => {
    const { disabled, speak } = useActionBarSpeakBehavior();
    if (disabled)
        return null;
    return speak;
};
export const ActionBarPrimitiveSpeak = createActionButton("ActionBarPrimitive.Speak", useActionBarSpeak);
//# sourceMappingURL=ActionBarSpeak.js.map