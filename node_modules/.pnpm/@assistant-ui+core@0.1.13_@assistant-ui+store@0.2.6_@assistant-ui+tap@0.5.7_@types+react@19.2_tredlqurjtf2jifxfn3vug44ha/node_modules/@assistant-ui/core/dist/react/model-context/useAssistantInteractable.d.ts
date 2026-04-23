import type { InteractableStateSchema } from "../types/scopes/interactables.js";
export type AssistantInteractableProps = {
    description: string;
    stateSchema: InteractableStateSchema;
    initialState: unknown;
    id?: string;
    selected?: boolean;
};
/**
 * Registers an interactable with the AI assistant.
 *
 * This hook handles registration only. To read and write the interactable's
 * state, use {@link useInteractableState} with the returned id.
 *
 * @returns The interactable instance id.
 */
export declare const useAssistantInteractable: (name: string, config: AssistantInteractableProps) => string;
//# sourceMappingURL=useAssistantInteractable.d.ts.map