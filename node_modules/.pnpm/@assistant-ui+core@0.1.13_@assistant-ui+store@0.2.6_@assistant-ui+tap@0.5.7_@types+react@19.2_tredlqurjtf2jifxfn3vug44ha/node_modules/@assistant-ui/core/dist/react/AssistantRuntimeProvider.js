import { jsx as _jsx } from "react/jsx-runtime";
import { memo } from "react";
import { AssistantProviderBase } from "./AssistantProvider.js";
export const AssistantRuntimeProvider = memo(({ runtime, aui, children, }) => {
    return (_jsx(AssistantProviderBase, { runtime: runtime, aui: aui ?? null, children: children }));
});
//# sourceMappingURL=AssistantRuntimeProvider.js.map