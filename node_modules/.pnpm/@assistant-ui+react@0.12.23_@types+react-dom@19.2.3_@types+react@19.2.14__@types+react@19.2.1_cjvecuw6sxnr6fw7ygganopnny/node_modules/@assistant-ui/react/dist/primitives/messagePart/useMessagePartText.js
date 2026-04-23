"use client";
import { useAuiState } from "@assistant-ui/store";
export const useMessagePartText = () => {
    const text = useAuiState((s) => {
        if (s.part.type !== "text" && s.part.type !== "reasoning")
            throw new Error("MessagePartText can only be used inside text or reasoning message parts.");
        return s.part;
    });
    return text;
};
//# sourceMappingURL=useMessagePartText.js.map