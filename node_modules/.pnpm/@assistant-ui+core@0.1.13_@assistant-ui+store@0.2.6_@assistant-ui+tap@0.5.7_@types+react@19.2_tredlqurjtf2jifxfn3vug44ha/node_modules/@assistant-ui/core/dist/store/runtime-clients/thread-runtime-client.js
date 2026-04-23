import { resource, tapResource, tapMemo, tapEffect, withKey, } from "@assistant-ui/tap";
import { tapAssistantEmit, tapClientLookup, tapClientResource, } from "@assistant-ui/store";
import { ComposerClient } from "./composer-runtime-client.js";
import { MessageClient } from "./message-runtime-client.js";
import { tapSubscribable } from "./tap-subscribable.js";
const MessageClientById = resource(({ runtime, id, threadIdRef, }) => {
    const messageRuntime = tapMemo(() => runtime.getMessageById(id), [runtime, id]);
    return tapResource(MessageClient({ runtime: messageRuntime, threadIdRef }));
});
export const ThreadClient = resource(({ runtime }) => {
    const runtimeState = tapSubscribable(runtime);
    const emit = tapAssistantEmit();
    tapEffect(() => {
        const unsubscribers = [];
        const threadEvents = [
            "runStart",
            "runEnd",
            "initialize",
            "modelContextUpdate",
        ];
        for (const event of threadEvents) {
            const unsubscribe = runtime.unstable_on(event, () => {
                const threadId = runtime.getState()?.threadId || "unknown";
                emit(`thread.${event}`, {
                    threadId,
                });
            });
            unsubscribers.push(unsubscribe);
        }
        return () => {
            for (const unsub of unsubscribers)
                unsub();
        };
    }, [runtime, emit]);
    const threadIdRef = tapMemo(() => ({
        get current() {
            return runtime.getState().threadId;
        },
    }), [runtime]);
    const composer = tapClientResource(ComposerClient({
        runtime: runtime.composer,
        threadIdRef,
    }));
    const messages = tapClientLookup(() => runtimeState.messages.map((m) => withKey(m.id, MessageClientById({ runtime, id: m.id, threadIdRef }))), [runtimeState.messages, runtime, threadIdRef]);
    const state = tapMemo(() => {
        return {
            isEmpty: messages.state.length === 0 && !runtimeState.isLoading,
            isDisabled: runtimeState.isDisabled,
            isLoading: runtimeState.isLoading,
            isRunning: runtimeState.isRunning,
            capabilities: runtimeState.capabilities,
            state: runtimeState.state,
            suggestions: runtimeState.suggestions,
            extras: runtimeState.extras,
            speech: runtimeState.speech,
            voice: runtimeState.voice,
            composer: composer.state,
            messages: messages.state,
        };
    }, [runtimeState, messages, composer.state]);
    return {
        getState: () => state,
        composer: () => composer.methods,
        append: runtime.append,
        startRun: runtime.startRun,
        resumeRun: runtime.resumeRun,
        unstable_resumeRun: runtime.resumeRun,
        cancelRun: runtime.cancelRun,
        getModelContext: runtime.getModelContext,
        export: runtime.export,
        import: runtime.import,
        reset: runtime.reset,
        stopSpeaking: runtime.stopSpeaking,
        connectVoice: runtime.connectVoice,
        disconnectVoice: runtime.disconnectVoice,
        getVoiceVolume: runtime.getVoiceVolume,
        subscribeVoiceVolume: runtime.subscribeVoiceVolume,
        muteVoice: runtime.muteVoice,
        unmuteVoice: runtime.unmuteVoice,
        message: (selector) => {
            if ("id" in selector) {
                return messages.get({ key: selector.id });
            }
            else {
                return messages.get(selector);
            }
        },
        __internal_getRuntime: () => runtime,
    };
});
//# sourceMappingURL=thread-runtime-client.js.map