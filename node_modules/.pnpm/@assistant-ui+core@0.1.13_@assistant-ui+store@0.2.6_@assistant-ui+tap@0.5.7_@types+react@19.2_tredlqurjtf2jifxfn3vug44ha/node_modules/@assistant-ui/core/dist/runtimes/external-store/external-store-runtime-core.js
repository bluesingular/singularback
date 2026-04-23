import { BaseAssistantRuntimeCore } from "../../runtime/base/base-assistant-runtime-core.js";
import { ExternalStoreThreadListRuntimeCore } from "./external-store-thread-list-runtime-core.js";
import { ExternalStoreThreadRuntimeCore } from "./external-store-thread-runtime-core.js";
const getThreadListAdapter = (store) => {
    return store.adapters?.threadList ?? {};
};
export class ExternalStoreRuntimeCore extends BaseAssistantRuntimeCore {
    threads;
    constructor(adapter) {
        super();
        this.threads = new ExternalStoreThreadListRuntimeCore(getThreadListAdapter(adapter), () => new ExternalStoreThreadRuntimeCore(this._contextProvider, adapter));
    }
    setAdapter(adapter) {
        // Update the thread list adapter and propagate store changes to the main thread
        this.threads.__internal_setAdapter(getThreadListAdapter(adapter));
        this.threads.getMainThreadRuntimeCore().__internal_setAdapter(adapter);
    }
}
//# sourceMappingURL=external-store-runtime-core.js.map