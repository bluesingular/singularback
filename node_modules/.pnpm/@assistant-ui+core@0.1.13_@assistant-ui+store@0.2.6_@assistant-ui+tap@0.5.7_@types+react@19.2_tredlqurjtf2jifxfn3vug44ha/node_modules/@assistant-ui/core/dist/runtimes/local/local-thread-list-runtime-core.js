import { BaseSubscribable } from "../../subscribable/subscribable.js";
const EMPTY_ARRAY = Object.freeze([]);
const DEFAULT_THREAD_ID = "__DEFAULT_ID__";
const DEFAULT_THREAD_DATA = Object.freeze({
    [DEFAULT_THREAD_ID]: {
        id: DEFAULT_THREAD_ID,
        remoteId: undefined,
        externalId: undefined,
        status: "regular",
        title: undefined,
    },
});
export class LocalThreadListRuntimeCore extends BaseSubscribable {
    _mainThread;
    constructor(_threadFactory) {
        super();
        this._mainThread = _threadFactory();
    }
    get isLoading() {
        return false;
    }
    getMainThreadRuntimeCore() {
        return this._mainThread;
    }
    get newThreadId() {
        return undefined;
    }
    get threadIds() {
        return EMPTY_ARRAY;
    }
    get archivedThreadIds() {
        return EMPTY_ARRAY;
    }
    get mainThreadId() {
        return DEFAULT_THREAD_ID;
    }
    get threadItems() {
        return DEFAULT_THREAD_DATA;
    }
    getThreadRuntimeCore() {
        throw new Error("Method not implemented.");
    }
    getLoadThreadsPromise() {
        return Promise.resolve();
    }
    getItemById(threadId) {
        if (threadId === this.mainThreadId) {
            return {
                status: "regular",
                id: this.mainThreadId,
                remoteId: this.mainThreadId,
                externalId: undefined,
                title: undefined,
                isMain: true,
            };
        }
        throw new Error("Method not implemented");
    }
    async switchToThread() {
        throw new Error("Method not implemented.");
    }
    switchToNewThread() {
        throw new Error("Method not implemented.");
    }
    rename() {
        throw new Error("Method not implemented.");
    }
    archive() {
        throw new Error("Method not implemented.");
    }
    detach() {
        throw new Error("Method not implemented.");
    }
    unarchive() {
        throw new Error("Method not implemented.");
    }
    delete() {
        throw new Error("Method not implemented.");
    }
    initialize(threadId) {
        return Promise.resolve({ remoteId: threadId, externalId: undefined });
    }
    generateTitle() {
        throw new Error("Method not implemented.");
    }
}
//# sourceMappingURL=local-thread-list-runtime-core.js.map