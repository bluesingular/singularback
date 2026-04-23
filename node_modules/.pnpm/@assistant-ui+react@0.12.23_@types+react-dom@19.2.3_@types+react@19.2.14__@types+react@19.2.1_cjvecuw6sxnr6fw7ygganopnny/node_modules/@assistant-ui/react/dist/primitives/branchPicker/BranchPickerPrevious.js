"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useBranchPickerPrevious as useBranchPickerPreviousBehavior } from "@assistant-ui/core/react";
const useBranchPickerPrevious = () => {
    const { disabled, previous } = useBranchPickerPreviousBehavior();
    if (disabled)
        return null;
    return previous;
};
/**
 * A button component that navigates to the previous branch in the message tree.
 *
 * This component automatically handles switching to the previous available branch
 * and is disabled when there are no previous branches to navigate to.
 *
 * @example
 * ```tsx
 * <BranchPickerPrimitive.Previous>
 *   ← Previous
 * </BranchPickerPrimitive.Previous>
 * ```
 */
export const BranchPickerPrimitivePrevious = createActionButton("BranchPickerPrimitive.Previous", useBranchPickerPrevious);
//# sourceMappingURL=BranchPickerPrevious.js.map