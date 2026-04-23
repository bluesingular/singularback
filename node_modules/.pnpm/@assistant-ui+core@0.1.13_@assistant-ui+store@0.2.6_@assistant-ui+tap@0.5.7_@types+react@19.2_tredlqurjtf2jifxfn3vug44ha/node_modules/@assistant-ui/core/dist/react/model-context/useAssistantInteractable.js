import { useEffect, useId, useRef } from "react";
import { useAui } from "@assistant-ui/store";
/**
 * Registers an interactable with the AI assistant.
 *
 * This hook handles registration only. To read and write the interactable's
 * state, use {@link useInteractableState} with the returned id.
 *
 * @returns The interactable instance id.
 */
export const useAssistantInteractable = (name, config) => {
    const aui = useAui();
    const autoId = useId().replace(/[^a-zA-Z0-9]/g, "");
    const id = config.id ?? autoId;
    const stateSchemaRef = useRef(config.stateSchema);
    stateSchemaRef.current = config.stateSchema;
    const initialStateRef = useRef(config.initialState);
    initialStateRef.current = config.initialState;
    useEffect(() => {
        return aui.interactables().register({
            id,
            name,
            description: config.description,
            stateSchema: stateSchemaRef.current,
            initialState: initialStateRef.current,
            selected: config.selected,
        });
    }, [aui, id, name, config.description, config.selected]);
    return id;
};
//# sourceMappingURL=useAssistantInteractable.js.map