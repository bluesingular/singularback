"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useThreadListItemTrigger as useThreadListItemTriggerBehavior } from "@assistant-ui/core/react";
const useThreadListItemTrigger = () => {
    const { switchTo } = useThreadListItemTriggerBehavior();
    return switchTo;
};
export const ThreadListItemPrimitiveTrigger = createActionButton("ThreadListItemPrimitive.Trigger", useThreadListItemTrigger);
//# sourceMappingURL=ThreadListItemTrigger.js.map