"use client";
import { useAuiState } from "@assistant-ui/store";
export const useMessagePartFile = () => {
    const file = useAuiState((s) => {
        if (s.part.type !== "file")
            throw new Error("MessagePartFile can only be used inside file message parts.");
        return s.part;
    });
    return file;
};
//# sourceMappingURL=useMessagePartFile.js.map