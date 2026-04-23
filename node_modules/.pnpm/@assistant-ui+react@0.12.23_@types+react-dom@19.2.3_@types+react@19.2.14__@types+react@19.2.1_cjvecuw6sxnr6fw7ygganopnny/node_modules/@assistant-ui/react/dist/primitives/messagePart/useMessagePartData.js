"use client";
import { useAuiState } from "@assistant-ui/store";
export const useMessagePartData = (name) => {
    const part = useAuiState((s) => {
        if (s.part.type !== "data") {
            return null;
        }
        return s.part;
    });
    if (!part) {
        return null;
    }
    if (name && part.name !== name) {
        return null;
    }
    return part;
};
//# sourceMappingURL=useMessagePartData.js.map