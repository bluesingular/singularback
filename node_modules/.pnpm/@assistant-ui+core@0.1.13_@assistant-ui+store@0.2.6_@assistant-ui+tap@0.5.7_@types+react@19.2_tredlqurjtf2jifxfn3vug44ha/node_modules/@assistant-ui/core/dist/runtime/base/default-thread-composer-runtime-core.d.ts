import type { AppendMessage } from "../../types/message.js";
import type { AttachmentAdapter } from "../../adapters/attachment.js";
import type { DictationAdapter } from "../../adapters/speech.js";
import type { SendOptions, ThreadComposerRuntimeCore } from "../interfaces/composer-runtime-core.js";
import type { ThreadRuntimeCore } from "../interfaces/thread-runtime-core.js";
import { BaseComposerRuntimeCore } from "./base-composer-runtime-core.js";
export declare class DefaultThreadComposerRuntimeCore extends BaseComposerRuntimeCore implements ThreadComposerRuntimeCore {
    private runtime;
    private _canCancel;
    get canCancel(): boolean;
    protected getAttachmentAdapter(): AttachmentAdapter | undefined;
    protected getDictationAdapter(): DictationAdapter | undefined;
    constructor(runtime: Omit<ThreadRuntimeCore, "composer"> & {
        adapters?: {
            attachments?: AttachmentAdapter | undefined;
            dictation?: DictationAdapter | undefined;
        } | undefined;
    });
    connect(): import("../..").Unsubscribe;
    handleSend(message: Omit<AppendMessage, "parentId" | "sourceId">, options?: SendOptions): Promise<void>;
    handleCancel(): Promise<void>;
}
//# sourceMappingURL=default-thread-composer-runtime-core.d.ts.map