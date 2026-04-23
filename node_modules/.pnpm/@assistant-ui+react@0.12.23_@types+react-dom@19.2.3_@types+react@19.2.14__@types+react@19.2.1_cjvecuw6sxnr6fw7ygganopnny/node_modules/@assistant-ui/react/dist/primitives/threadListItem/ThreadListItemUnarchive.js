"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useThreadListItemUnarchive as useThreadListItemUnarchiveBehavior } from "@assistant-ui/core/react";
const useThreadListItemUnarchive = () => {
    const { unarchive } = useThreadListItemUnarchiveBehavior();
    return unarchive;
};
export const ThreadListItemPrimitiveUnarchive = createActionButton("ThreadListItemPrimitive.Unarchive", useThreadListItemUnarchive);
//# sourceMappingURL=ThreadListItemUnarchive.js.map