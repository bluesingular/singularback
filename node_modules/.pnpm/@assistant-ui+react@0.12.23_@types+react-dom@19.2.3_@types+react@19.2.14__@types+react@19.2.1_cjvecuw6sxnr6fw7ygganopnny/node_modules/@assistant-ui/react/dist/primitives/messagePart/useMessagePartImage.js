"use client";
import { useAuiState } from "@assistant-ui/store";
export const useMessagePartImage = () => {
    const image = useAuiState((s) => {
        if (s.part.type !== "image")
            throw new Error("MessagePartImage can only be used inside image message parts.");
        return s.part;
    });
    return image;
};
//# sourceMappingURL=useMessagePartImage.js.map