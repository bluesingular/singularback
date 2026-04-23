"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useEffect } from "react";
import { useAui } from "@assistant-ui/store";
import { AssistantProviderBase } from "@assistant-ui/core/react";
import { ThreadPrimitiveViewportProvider } from "../context/providers/ThreadViewportProvider.js";
import { DevToolsProviderApi } from "../devtools/DevToolsHooks.js";
const DevToolsRegistration = () => {
    const aui = useAui();
    useEffect(() => {
        if (typeof process === "undefined" || process.env.NODE_ENV === "production")
            return;
        return DevToolsProviderApi.register(aui);
    }, [aui]);
    return null;
};
export const AssistantRuntimeProviderImpl = ({ children, aui, runtime }) => {
    return (_jsxs(AssistantProviderBase, { runtime: runtime, aui: aui ?? null, children: [_jsx(DevToolsRegistration, {}), _jsx(ThreadPrimitiveViewportProvider, { children: children })] }));
};
export const AssistantRuntimeProvider = memo(AssistantRuntimeProviderImpl);
//# sourceMappingURL=AssistantRuntimeProvider.js.map