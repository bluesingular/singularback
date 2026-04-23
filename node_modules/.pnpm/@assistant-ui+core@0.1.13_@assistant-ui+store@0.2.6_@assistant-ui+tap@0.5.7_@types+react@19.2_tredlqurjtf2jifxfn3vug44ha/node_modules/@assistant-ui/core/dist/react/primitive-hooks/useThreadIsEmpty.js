import { useAuiState } from "@assistant-ui/store";
export const useThreadIsEmpty = () => {
    return useAuiState((s) => s.thread.isEmpty);
};
//# sourceMappingURL=useThreadIsEmpty.js.map