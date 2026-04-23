"use client";
import { useAuiState } from "@assistant-ui/store";
const useThreadIf = (props) => {
    return useAuiState((s) => {
        if (props.empty === true && !s.thread.isEmpty)
            return false;
        if (props.empty === false && s.thread.isEmpty)
            return false;
        if (props.running === true && !s.thread.isRunning)
            return false;
        if (props.running === false && s.thread.isRunning)
            return false;
        if (props.disabled === true && !s.thread.isDisabled)
            return false;
        if (props.disabled === false && s.thread.isDisabled)
            return false;
        return true;
    });
};
/**
 * @deprecated Use `<AuiIf condition={(s) => s.thread...} />` instead.
 */
export const ThreadPrimitiveIf = ({ children, ...query }) => {
    const result = useThreadIf(query);
    return result ? children : null;
};
ThreadPrimitiveIf.displayName = "ThreadPrimitive.If";
//# sourceMappingURL=ThreadIf.js.map