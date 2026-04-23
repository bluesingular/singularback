import type { AssistantRuntime, ChatModelAdapter, ThreadMessageLike } from "../../index.js";
import type { LocalRuntimeOptionsBase } from "../../runtimes/local/local-runtime-options.js";
import type { AssistantCloud } from "assistant-cloud";
export type LocalRuntimeOptions = Omit<LocalRuntimeOptionsBase, "adapters"> & {
    cloud?: AssistantCloud | undefined;
    initialMessages?: readonly ThreadMessageLike[] | undefined;
    adapters?: Omit<LocalRuntimeOptionsBase["adapters"], "chatModel"> | undefined;
};
export declare const splitLocalRuntimeOptions: <T extends LocalRuntimeOptions>(options: T) => {
    localRuntimeOptions: {
        cloud: AssistantCloud | undefined;
        initialMessages: readonly ThreadMessageLike[] | undefined;
        maxSteps: number | undefined;
        adapters: Omit<{
            chatModel: ChatModelAdapter;
            history?: import("../../index").ThreadHistoryAdapter | undefined;
            attachments?: import("../../index").AttachmentAdapter | undefined;
            speech?: import("../../index").SpeechSynthesisAdapter | undefined;
            dictation?: import("../../index").DictationAdapter | undefined;
            voice?: import("../../index").RealtimeVoiceAdapter | undefined;
            feedback?: import("../../index").FeedbackAdapter | undefined;
            suggestion?: import("../../index").SuggestionAdapter | undefined;
        }, "chatModel"> | undefined;
        unstable_humanToolNames: string[] | undefined;
    };
    otherOptions: Omit<T, "initialMessages" | "adapters" | "maxSteps" | "unstable_humanToolNames" | "cloud">;
};
export declare const useLocalRuntime: (chatModel: ChatModelAdapter, { cloud, ...options }?: LocalRuntimeOptions) => AssistantRuntime;
//# sourceMappingURL=useLocalRuntime.d.ts.map