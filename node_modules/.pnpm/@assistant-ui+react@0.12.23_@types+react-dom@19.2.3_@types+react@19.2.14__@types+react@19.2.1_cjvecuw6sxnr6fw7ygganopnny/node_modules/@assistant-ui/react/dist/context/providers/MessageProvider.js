"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useAui, AuiProvider } from "@assistant-ui/store";
import { ThreadMessageClient, } from "@assistant-ui/core/store";
export const MessageProvider = ({ children, ...props }) => {
    const aui = useAui({
        message: ThreadMessageClient(props),
    });
    return _jsx(AuiProvider, { value: aui, children: children });
};
//# sourceMappingURL=MessageProvider.js.map