import { resource, tapResource } from "@assistant-ui/tap";
import { RuntimeAdapterResource, baseRuntimeAdapterTransformScopes, } from "../store/internal.js";
import { attachTransformScopes } from "@assistant-ui/store";
import { DataRenderers } from "./client/DataRenderers.js";
import { Tools } from "./client/Tools.js";
export const RuntimeAdapter = resource((runtime) => tapResource(RuntimeAdapterResource(runtime)));
attachTransformScopes(RuntimeAdapter, (scopes, parent) => {
    baseRuntimeAdapterTransformScopes(scopes, parent);
    if (!scopes.tools && parent.tools.source === null) {
        scopes.tools = Tools({});
    }
    if (!scopes.dataRenderers && parent.dataRenderers.source === null) {
        scopes.dataRenderers = DataRenderers();
    }
});
//# sourceMappingURL=RuntimeAdapter.js.map