"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useThreadListItemDelete as useThreadListItemDeleteBehavior } from "@assistant-ui/core/react";
const useThreadListItemDelete = () => {
    const { delete: deleteThread } = useThreadListItemDeleteBehavior();
    return deleteThread;
};
export const ThreadListItemPrimitiveDelete = createActionButton("ThreadListItemPrimitive.Delete", useThreadListItemDelete);
//# sourceMappingURL=ThreadListItemDelete.js.map