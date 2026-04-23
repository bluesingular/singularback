import { useCallback } from "react";
import { useAui, useAuiState } from "@assistant-ui/store";
export const useComposerSend = () => {
    const aui = useAui();
    const disabled = useAuiState((s) => (s.thread.isRunning && !s.thread.capabilities.queue) ||
        !s.composer.isEditing ||
        s.composer.isEmpty);
    const send = useCallback((opts) => {
        aui.composer().send(opts);
    }, [aui]);
    return { send, disabled };
};
//# sourceMappingURL=useComposerSend.js.map