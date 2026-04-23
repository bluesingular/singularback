"use client";
import { useAuiState } from "@assistant-ui/store";
/**
 * @deprecated Use `<AuiIf condition={(s) => s.thread.isEmpty} />` instead.
 */
export const ThreadPrimitiveEmpty = ({ children, }) => {
    const empty = useAuiState((s) => s.thread.isEmpty);
    return empty ? children : null;
};
ThreadPrimitiveEmpty.displayName = "ThreadPrimitive.Empty";
//# sourceMappingURL=ThreadEmpty.js.map