import type { Tool } from "assistant-stream";
import type { InteractableDefinition, InteractableStateSchema } from "../types/scopes/interactables.js";
export declare function shallowMerge(prev: unknown, partial: unknown): unknown;
export declare function buildInteractableModelContext(definitions: Record<string, InteractableDefinition>, partialSchemaCache: Map<string, InteractableStateSchema>, setDefState: (id: string, updater: (prev: unknown) => unknown) => void): {
    system: string;
    tools: Record<string, Tool<any, any>>;
} | undefined;
//# sourceMappingURL=interactable-model-context.d.ts.map