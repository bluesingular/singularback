import type { ThreadHistoryAdapter } from "../../adapters/thread-history.js";
import type { AttachmentAdapter } from "../../adapters/attachment.js";
import type { FeedbackAdapter } from "../../adapters/feedback.js";
import type { SpeechSynthesisAdapter, DictationAdapter } from "../../adapters/speech.js";
import type { RealtimeVoiceAdapter } from "../../adapters/voice.js";
import type { SuggestionAdapter } from "../../adapters/suggestion.js";
import type { ChatModelAdapter } from "../../runtime/utils/chat-model-adapter.js";
export type LocalRuntimeOptionsBase = {
    maxSteps?: number | undefined;
    adapters: {
        chatModel: ChatModelAdapter;
        history?: ThreadHistoryAdapter | undefined;
        attachments?: AttachmentAdapter | undefined;
        speech?: SpeechSynthesisAdapter | undefined;
        dictation?: DictationAdapter | undefined;
        voice?: RealtimeVoiceAdapter | undefined;
        feedback?: FeedbackAdapter | undefined;
        suggestion?: SuggestionAdapter | undefined;
    };
    /**
     * Names of tools that are allowed to interrupt the run in order to wait for human/external approval.
     */
    unstable_humanToolNames?: string[] | undefined;
};
//# sourceMappingURL=local-runtime-options.d.ts.map