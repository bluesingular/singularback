"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useThreadListItemArchive as useThreadListItemArchiveBehavior } from "@assistant-ui/core/react";
const useThreadListItemArchive = () => {
    const { archive } = useThreadListItemArchiveBehavior();
    return archive;
};
export const ThreadListItemPrimitiveArchive = createActionButton("ThreadListItemPrimitive.Archive", useThreadListItemArchive);
//# sourceMappingURL=ThreadListItemArchive.js.map