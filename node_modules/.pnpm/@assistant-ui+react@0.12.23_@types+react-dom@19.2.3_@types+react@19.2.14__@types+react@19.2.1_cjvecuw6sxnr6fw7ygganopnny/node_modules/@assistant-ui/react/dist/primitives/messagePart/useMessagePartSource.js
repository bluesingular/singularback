"use client";
import { useAuiState } from "@assistant-ui/store";
export const useMessagePartSource = () => {
    const source = useAuiState((s) => {
        if (s.part.type !== "source")
            throw new Error("MessagePartSource can only be used inside source message parts.");
        return s.part;
    });
    return source;
};
//# sourceMappingURL=useMessagePartSource.js.map