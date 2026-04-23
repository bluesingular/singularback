import { useAuiState } from "@assistant-ui/store";
export const useThreadMessages = () => {
    return useAuiState((s) => s.thread.messages);
};
//# sourceMappingURL=useThreadMessages.js.map