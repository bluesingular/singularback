import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, } from "react";
import { useAui, AuiProvider } from "@assistant-ui/store";
import { RuntimeAdapter } from "./RuntimeAdapter.js";
export const getRenderComponent = (runtime) => {
    return runtime._core?.RenderComponent;
};
export const AssistantProviderBase = memo(({ runtime, aui: parent = null, children }) => {
    const aui = useAui({ threads: RuntimeAdapter(runtime) }, { parent });
    const RenderComponent = getRenderComponent(runtime);
    return (_jsxs(AuiProvider, { value: aui, children: [RenderComponent && _jsx(RenderComponent, {}), children] }));
});
//# sourceMappingURL=AssistantProvider.js.map