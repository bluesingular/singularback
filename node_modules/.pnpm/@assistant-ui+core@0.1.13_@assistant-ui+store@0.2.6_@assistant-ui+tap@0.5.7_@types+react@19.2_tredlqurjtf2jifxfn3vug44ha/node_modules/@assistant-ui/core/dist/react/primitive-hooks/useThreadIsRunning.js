import { useAuiState } from "@assistant-ui/store";
export const useThreadIsRunning = () => {
    return useAuiState((s) => s.thread.isRunning);
};
//# sourceMappingURL=useThreadIsRunning.js.map