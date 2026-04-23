import { jsx as _jsx } from "react/jsx-runtime";
import { useAui, AuiProvider } from "@assistant-ui/store";
import { ThreadListItemClient } from "../../store/internal.js";
export const ThreadListItemRuntimeProvider = ({ runtime, children }) => {
    const aui = useAui({
        threadListItem: ThreadListItemClient({ runtime }),
    });
    return _jsx(AuiProvider, { value: aui, children: children });
};
//# sourceMappingURL=ThreadListItemRuntimeProvider.js.map