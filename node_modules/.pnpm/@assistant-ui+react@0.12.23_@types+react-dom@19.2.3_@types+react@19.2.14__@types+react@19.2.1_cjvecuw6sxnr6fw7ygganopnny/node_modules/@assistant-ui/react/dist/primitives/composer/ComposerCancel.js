"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useComposerCancel as useComposerCancelBehavior } from "@assistant-ui/core/react";
const useComposerCancel = () => {
    const { disabled, cancel } = useComposerCancelBehavior();
    if (disabled)
        return null;
    return cancel;
};
/**
 * A button component that cancels the current message composition.
 *
 * This component automatically handles the cancel functionality and is disabled
 * when canceling is not available.
 *
 * @example
 * ```tsx
 * <ComposerPrimitive.Cancel>
 *   Cancel
 * </ComposerPrimitive.Cancel>
 * ```
 */
export const ComposerPrimitiveCancel = createActionButton("ComposerPrimitive.Cancel", useComposerCancel);
//# sourceMappingURL=ComposerCancel.js.map