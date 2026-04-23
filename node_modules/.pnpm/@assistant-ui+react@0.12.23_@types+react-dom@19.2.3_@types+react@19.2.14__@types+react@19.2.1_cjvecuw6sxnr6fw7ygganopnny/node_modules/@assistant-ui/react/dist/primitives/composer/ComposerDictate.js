"use client";
import { createActionButton } from "../../utils/createActionButton.js";
import { useComposerDictate as useComposerDictateBehavior } from "@assistant-ui/core/react";
const useComposerDictate = () => {
    const { disabled, startDictation } = useComposerDictateBehavior();
    if (disabled)
        return null;
    return startDictation;
};
/**
 * A button that starts dictation to convert voice to text.
 *
 * Requires a DictationAdapter to be configured in the runtime.
 *
 * @example
 * ```tsx
 * <ComposerPrimitive.Dictate>
 *   <MicIcon />
 * </ComposerPrimitive.Dictate>
 * ```
 */
export const ComposerPrimitiveDictate = createActionButton("ComposerPrimitive.Dictate", useComposerDictate);
//# sourceMappingURL=ComposerDictate.js.map