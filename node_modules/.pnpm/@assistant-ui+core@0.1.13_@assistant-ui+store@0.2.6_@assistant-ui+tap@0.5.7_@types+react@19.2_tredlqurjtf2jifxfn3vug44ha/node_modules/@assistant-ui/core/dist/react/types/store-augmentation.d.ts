import type { ToolsClientSchema } from "./scopes/tools.js";
import type { DataRenderersClientSchema } from "./scopes/dataRenderers.js";
import type { InteractablesClientSchema } from "./scopes/interactables.js";
declare module "@assistant-ui/store" {
    interface ScopeRegistry {
        tools: ToolsClientSchema;
        dataRenderers: DataRenderersClientSchema;
        interactables: InteractablesClientSchema;
    }
}
//# sourceMappingURL=store-augmentation.d.ts.map