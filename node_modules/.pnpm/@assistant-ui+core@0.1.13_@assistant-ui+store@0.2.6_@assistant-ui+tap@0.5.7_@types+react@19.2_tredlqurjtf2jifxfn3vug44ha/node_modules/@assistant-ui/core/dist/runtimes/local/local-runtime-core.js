import { BaseAssistantRuntimeCore } from "../../runtime/base/base-assistant-runtime-core.js";
import { LocalThreadRuntimeCore } from "./local-thread-runtime-core.js";
import { LocalThreadListRuntimeCore } from "./local-thread-list-runtime-core.js";
import { ExportedMessageRepository } from "../../runtime/utils/message-repository.js";
export class LocalRuntimeCore extends BaseAssistantRuntimeCore {
    threads;
    Provider = undefined;
    _options;
    constructor(options, initialMessages) {
        super();
        this._options = options;
        this.threads = new LocalThreadListRuntimeCore(() => {
            return new LocalThreadRuntimeCore(this._contextProvider, this._options);
        });
        if (initialMessages) {
            this.threads
                .getMainThreadRuntimeCore()
                .import(ExportedMessageRepository.fromArray(initialMessages));
        }
    }
}
//# sourceMappingURL=local-runtime-core.js.map