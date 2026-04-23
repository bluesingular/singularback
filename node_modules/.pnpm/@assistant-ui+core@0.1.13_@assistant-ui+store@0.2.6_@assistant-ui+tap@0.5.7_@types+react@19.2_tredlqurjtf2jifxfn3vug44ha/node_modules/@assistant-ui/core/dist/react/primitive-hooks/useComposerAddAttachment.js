import { useCallback } from "react";
import { useAui, useAuiState } from "@assistant-ui/store";
export const useComposerAddAttachment = () => {
    const aui = useAui();
    const disabled = useAuiState((s) => !s.composer.isEditing);
    const addAttachment = useCallback((file) => {
        return aui.composer().addAttachment(file);
    }, [aui]);
    return { addAttachment, disabled };
};
//# sourceMappingURL=useComposerAddAttachment.js.map