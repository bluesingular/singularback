import { useCallback } from "react";
import { useAui, useAuiState } from "@assistant-ui/store";
/**
 * Reads and writes the state of a registered interactable.
 *
 * Pair with {@link useAssistantInteractable} which handles registration.
 */
export const useInteractableState = (id, fallback) => {
    const aui = useAui();
    const state = useAuiState((s) => s.interactables.definitions[id]?.state) ??
        fallback;
    const persistenceStatus = useAuiState((s) => s.interactables.persistence[id]);
    const setState = useCallback((updater) => {
        aui.interactables().setState(id, (prev) => {
            if (typeof updater === "function") {
                return updater(prev);
            }
            return updater;
        });
    }, [aui, id]);
    const setSelected = useCallback((selected) => {
        aui.interactables().setSelected(id, selected);
    }, [aui, id]);
    const flush = useCallback(() => aui.interactables().flush(), [aui]);
    return [
        state,
        {
            setState,
            setSelected,
            isPending: persistenceStatus?.isPending ?? false,
            error: persistenceStatus?.error,
            flush,
        },
    ];
};
//# sourceMappingURL=useInteractableState.js.map