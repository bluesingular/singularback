import { jsx as _jsx } from "react/jsx-runtime";
import { AuiProvider, Derived, useAui } from "@assistant-ui/store";
export const QueueItemByIndexProvider = ({ index, children, }) => {
    const aui = useAui({
        queueItem: Derived({
            source: "composer",
            query: { index },
            get: (aui) => aui.composer().queueItem({ index }),
        }),
    });
    return _jsx(AuiProvider, { value: aui, children: children });
};
//# sourceMappingURL=QueueItemByIndexProvider.js.map