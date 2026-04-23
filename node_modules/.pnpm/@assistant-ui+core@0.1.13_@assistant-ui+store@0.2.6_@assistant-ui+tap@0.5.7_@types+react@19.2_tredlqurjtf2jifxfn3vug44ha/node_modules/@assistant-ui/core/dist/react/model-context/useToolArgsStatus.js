import { useMemo } from "react";
import { useAuiState } from "@assistant-ui/store";
import { getPartialJsonObjectFieldState, getPartialJsonObjectMeta, } from "assistant-stream/utils";
export const useToolArgsStatus = () => {
    const part = useAuiState((s) => s.part);
    return useMemo(() => {
        const statusType = part.status.type;
        if (part.type !== "tool-call") {
            throw new Error("useToolArgsStatus can only be used inside tool-call message parts");
        }
        const isStreaming = statusType === "running";
        const args = part.args;
        const meta = getPartialJsonObjectMeta(args);
        const propStatus = {};
        for (const key of Object.keys(args)) {
            if (meta) {
                const fieldState = getPartialJsonObjectFieldState(args, [key]);
                propStatus[key] =
                    fieldState === "complete" || !isStreaming ? "complete" : "streaming";
            }
            else {
                propStatus[key] = isStreaming ? "streaming" : "complete";
            }
        }
        return {
            status: statusType,
            propStatus: propStatus,
        };
    }, [part]);
};
//# sourceMappingURL=useToolArgsStatus.js.map