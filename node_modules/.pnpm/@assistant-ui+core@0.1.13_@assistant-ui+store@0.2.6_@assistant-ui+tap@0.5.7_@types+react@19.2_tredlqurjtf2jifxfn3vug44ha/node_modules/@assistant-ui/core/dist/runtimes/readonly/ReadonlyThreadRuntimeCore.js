import { BaseSubscribable } from "../../subscribable/subscribable.js";
const READONLY_THREAD_ERROR = new Error("This is a readonly thread. You cannot perform mutations on readonly threads.");
export class ReadonlyThreadRuntimeCore extends BaseSubscribable {
    _messages = [];
    get messages() {
        return this._messages;
    }
    setMessages(messages) {
        if (this._messages === messages)
            return;
        this._messages = messages;
        this._notifySubscribers();
    }
    getMessageById(messageId) {
        const idx = this._messages.findIndex((m) => m.id === messageId);
        if (idx === -1)
            return undefined;
        return {
            parentId: this._messages[idx - 1]?.id ?? null,
            message: this._messages[idx],
            index: idx,
        };
    }
    getBranches(messageId) {
        const idx = this._messages.findIndex((m) => m.id === messageId);
        if (idx === -1)
            return [];
        return [messageId];
    }
    switchToBranch() {
        throw READONLY_THREAD_ERROR;
    }
    append() {
        throw READONLY_THREAD_ERROR;
    }
    startRun() {
        throw READONLY_THREAD_ERROR;
    }
    resumeRun() {
        throw READONLY_THREAD_ERROR;
    }
    cancelRun() { }
    addToolResult() {
        throw READONLY_THREAD_ERROR;
    }
    resumeToolCall() {
        throw READONLY_THREAD_ERROR;
    }
    speak() {
        throw READONLY_THREAD_ERROR;
    }
    stopSpeaking() { }
    connectVoice() {
        throw READONLY_THREAD_ERROR;
    }
    disconnectVoice() { }
    getVoiceVolume = () => 0;
    subscribeVoiceVolume = () => () => { };
    muteVoice() {
        throw READONLY_THREAD_ERROR;
    }
    unmuteVoice() {
        throw READONLY_THREAD_ERROR;
    }
    submitFeedback() {
        throw READONLY_THREAD_ERROR;
    }
    getModelContext() {
        return {};
    }
    exportExternalState() {
        throw READONLY_THREAD_ERROR;
    }
    importExternalState() {
        throw READONLY_THREAD_ERROR;
    }
    unstable_loadExternalState() {
        throw READONLY_THREAD_ERROR;
    }
    composer = {
        attachments: [],
        attachmentAccept: "*",
        async addAttachment() {
            throw READONLY_THREAD_ERROR;
        },
        async removeAttachment() {
            throw READONLY_THREAD_ERROR;
        },
        isEditing: false,
        canCancel: false,
        isEmpty: true,
        text: "",
        setText() {
            throw READONLY_THREAD_ERROR;
        },
        role: "user",
        setRole() {
            throw READONLY_THREAD_ERROR;
        },
        runConfig: {},
        setRunConfig() {
            throw READONLY_THREAD_ERROR;
        },
        async reset() {
            // noop
        },
        async clearAttachments() {
            // noop
        },
        send() {
            throw READONLY_THREAD_ERROR;
        },
        cancel() {
            // noop
        },
        dictation: undefined,
        startDictation() {
            throw READONLY_THREAD_ERROR;
        },
        stopDictation() {
            // noop
        },
        quote: undefined,
        setQuote() {
            throw READONLY_THREAD_ERROR;
        },
        subscribe() {
            return () => { };
        },
        unstable_on() {
            return () => { };
        },
    };
    getEditComposer() {
        return undefined;
    }
    beginEdit() {
        throw READONLY_THREAD_ERROR;
    }
    speech = undefined;
    voice = undefined;
    capabilities = {
        switchToBranch: false,
        switchBranchDuringRun: false,
        edit: false,
        reload: false,
        cancel: false,
        unstable_copy: false,
        speech: false,
        dictation: false,
        voice: false,
        attachments: false,
        feedback: false,
        queue: false,
    };
    isDisabled = false;
    isLoading = false;
    state = null;
    suggestions = [];
    extras = undefined;
    import() {
        throw READONLY_THREAD_ERROR;
    }
    export() {
        return {
            messages: this._messages.map((message, idx) => ({
                message,
                parentId: this._messages[idx - 1]?.id ?? null,
            })),
        };
    }
    reset() {
        throw READONLY_THREAD_ERROR;
    }
    unstable_on() {
        return () => { };
    }
}
//# sourceMappingURL=ReadonlyThreadRuntimeCore.js.map