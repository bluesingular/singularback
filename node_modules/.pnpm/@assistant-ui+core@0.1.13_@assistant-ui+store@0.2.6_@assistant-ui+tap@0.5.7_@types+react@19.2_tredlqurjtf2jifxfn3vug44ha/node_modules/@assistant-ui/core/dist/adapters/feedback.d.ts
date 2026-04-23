import type { ThreadMessage } from "../types/message.js";
type FeedbackAdapterFeedback = {
    message: ThreadMessage;
    type: "positive" | "negative";
};
export type FeedbackAdapter = {
    submit: (feedback: FeedbackAdapterFeedback) => void;
};
export {};
//# sourceMappingURL=feedback.d.ts.map