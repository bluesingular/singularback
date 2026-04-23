import { jsx as _jsx } from "react/jsx-runtime";
import { memo } from "react";
import { useAuiState } from "@assistant-ui/store";
import { ReadonlyThreadProvider } from "../../providers/ReadonlyThreadProvider.js";
import { ThreadPrimitiveMessagesImpl, } from "../thread/ThreadMessages.js";
const usePartMessages = () => {
    return useAuiState((s) => {
        const part = s.part;
        if (part.type !== "tool-call")
            return undefined;
        return "messages" in part
            ? part.messages
            : undefined;
    });
};
/**
 * Renders the nested messages of a tool call part (e.g. sub-agent conversation).
 *
 * This primitive reads `messages` from the current tool call part in the PartScope
 * and renders them using a readonly thread context. All existing message and part
 * primitives work inside, and parent tool UI registrations are inherited.
 *
 * @example
 * ```tsx
 * const SubAgentToolUI = makeAssistantToolUI({
 *   toolName: "invoke_sub_agent",
 *   render: () => (
 *     <PartPrimitive.Messages>
 *       {({ message }) => {
 *         if (message.role === "user") return <MyUserMessage />;
 *         return <MyAssistantMessage />;
 *       }}
 *     </PartPrimitive.Messages>
 *   ),
 * });
 * ```
 */
export const PartPrimitiveMessagesImpl = ({ components, children, }) => {
    const messages = usePartMessages();
    if (!messages?.length)
        return null;
    if (children) {
        return (_jsx(ReadonlyThreadProvider, { messages: messages, children: _jsx(ThreadPrimitiveMessagesImpl, { children: children }) }));
    }
    return (_jsx(ReadonlyThreadProvider, { messages: messages, children: _jsx(ThreadPrimitiveMessagesImpl, { components: components }) }));
};
PartPrimitiveMessagesImpl.displayName = "PartPrimitive.Messages";
export const PartPrimitiveMessages = memo(PartPrimitiveMessagesImpl);
//# sourceMappingURL=PartMessages.js.map