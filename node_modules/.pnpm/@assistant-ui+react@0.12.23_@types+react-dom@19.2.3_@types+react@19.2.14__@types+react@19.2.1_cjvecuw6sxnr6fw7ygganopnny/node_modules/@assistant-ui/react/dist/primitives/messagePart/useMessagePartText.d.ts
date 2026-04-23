import type { TextMessagePart, ReasoningMessagePart } from "@assistant-ui/core";
export declare const useMessagePartText: () => (TextMessagePart & {
    readonly status: import("@assistant-ui/core").MessagePartStatus | import("@assistant-ui/core").ToolCallMessagePartStatus;
}) | (ReasoningMessagePart & {
    readonly status: import("@assistant-ui/core").MessagePartStatus | import("@assistant-ui/core").ToolCallMessagePartStatus;
});
//# sourceMappingURL=useMessagePartText.d.ts.map