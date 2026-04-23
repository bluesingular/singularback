"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useBranchPickerNext as useBranchPickerNextBehavior } from "@assistant-ui/core/react";
const useBranchPickerNext = () => {
    const { disabled, next } = useBranchPickerNextBehavior();
    if (disabled)
        return null;
    return next;
};
/**
 * A button component that navigates to the next branch in the message tree.
 *
 * This component automatically handles switching to the next available branch
 * and is disabled when there are no more branches to navigate to.
 *
 * @example
 * ```tsx
 * <BranchPickerPrimitive.Next>
 *   Next →
 * </BranchPickerPrimitive.Next>
 * ```
 */
export const BranchPickerPrimitiveNext = createActionButton("BranchPickerPrimitive.Next", useBranchPickerNext);
//# sourceMappingURL=BranchPickerNext.js.map