"use client";
import { useAuiState } from "@assistant-ui/store";
export const useMessagePartReasoning = () => {
    const text = useAuiState((s) => {
        if (s.part.type !== "reasoning")
            throw new Error("MessagePartReasoning can only be used inside reasoning message parts.");
        return s.part;
    });
    return text;
};
//# sourceMappingURL=useMessagePartReasoning.js.map