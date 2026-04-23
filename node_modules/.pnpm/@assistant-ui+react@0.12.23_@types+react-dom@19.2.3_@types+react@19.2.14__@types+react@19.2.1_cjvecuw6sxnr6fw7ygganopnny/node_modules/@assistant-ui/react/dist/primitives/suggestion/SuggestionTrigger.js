"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useCallback } from "react";
import { useAuiState, useAui } from "@assistant-ui/store";
const useSuggestionTrigger = ({ send, clearComposer = true, }) => {
    const aui = useAui();
    const disabled = useAuiState((s) => s.thread.isDisabled);
    const prompt = useAuiState((s) => s.suggestion.prompt);
    const resolvedSend = send ?? false;
    const callback = useCallback(() => {
        const isRunning = aui.thread().getState().isRunning;
        if (resolvedSend && !isRunning) {
            aui.thread().append({
                content: [{ type: "text", text: prompt }],
                runConfig: aui.composer().getState().runConfig,
            });
            if (clearComposer) {
                aui.composer().setText("");
            }
        }
        else {
            if (clearComposer) {
                aui.composer().setText(prompt);
            }
            else {
                const currentText = aui.composer().getState().text;
                aui
                    .composer()
                    .setText(currentText.trim() ? `${currentText} ${prompt}` : prompt);
            }
        }
    }, [aui, resolvedSend, clearComposer, prompt]);
    if (disabled)
        return null;
    return callback;
};
/**
 * A button that triggers the suggestion action (send or insert into composer).
 *
 * @example
 * ```tsx
 * <SuggestionPrimitive.Trigger send>
 *   Click me
 * </SuggestionPrimitive.Trigger>
 * ```
 */
export const SuggestionPrimitiveTrigger = createActionButton("SuggestionPrimitive.Trigger", useSuggestionTrigger, ["send", "clearComposer"]);
//# sourceMappingURL=SuggestionTrigger.js.map