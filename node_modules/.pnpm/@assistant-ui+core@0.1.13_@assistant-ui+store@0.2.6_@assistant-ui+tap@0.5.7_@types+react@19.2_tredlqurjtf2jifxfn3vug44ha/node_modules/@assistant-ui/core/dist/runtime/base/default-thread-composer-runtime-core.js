import { BaseComposerRuntimeCore } from "./base-composer-runtime-core.js";
export class DefaultThreadComposerRuntimeCore extends BaseComposerRuntimeCore {
    runtime;
    _canCancel = false;
    get canCancel() {
        return this._canCancel;
    }
    getAttachmentAdapter() {
        return this.runtime.adapters?.attachments;
    }
    getDictationAdapter() {
        return this.runtime.adapters?.dictation;
    }
    constructor(runtime) {
        super();
        this.runtime = runtime;
        this.connect();
    }
    connect() {
        return this.runtime.subscribe(() => {
            if (this.canCancel !== this.runtime.capabilities.cancel) {
                this._canCancel = this.runtime.capabilities.cancel;
                this._notifySubscribers();
            }
        });
    }
    async handleSend(message, options) {
        this.runtime.append({
            ...message,
            parentId: this.runtime.messages.at(-1)?.id ?? null,
            sourceId: null,
            startRun: options?.startRun,
        });
    }
    async handleCancel() {
        this.runtime.cancelRun();
    }
}
//# sourceMappingURL=default-thread-composer-runtime-core.js.map