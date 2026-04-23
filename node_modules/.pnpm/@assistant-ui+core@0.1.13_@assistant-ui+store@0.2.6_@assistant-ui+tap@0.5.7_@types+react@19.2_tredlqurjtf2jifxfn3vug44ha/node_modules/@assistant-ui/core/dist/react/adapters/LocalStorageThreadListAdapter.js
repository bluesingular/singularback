import { jsx as _jsx } from "react/jsx-runtime";
import { createAssistantStream } from "assistant-stream";
import { useMemo } from "react";
import { useAui } from "@assistant-ui/store";
import { RuntimeAdapterProvider } from "../runtimes/RuntimeAdapterProvider.js";
class AsyncStorageHistoryAdapter {
    storage;
    aui;
    prefix;
    constructor(storage, aui, prefix) {
        this.storage = storage;
        this.aui = aui;
        this.prefix = prefix;
    }
    _messagesKey(remoteId) {
        return `${this.prefix}messages:${remoteId}`;
    }
    async load() {
        const remoteId = this.aui.threadListItem().getState().remoteId;
        if (!remoteId)
            return { messages: [] };
        const raw = await this.storage.getItem(this._messagesKey(remoteId));
        if (!raw)
            return { messages: [] };
        return JSON.parse(raw);
    }
    async append(item) {
        const { remoteId } = await this.aui.threadListItem().initialize();
        const key = this._messagesKey(remoteId);
        const raw = await this.storage.getItem(key);
        const repo = raw
            ? JSON.parse(raw)
            : { messages: [] };
        const idx = repo.messages.findIndex((m) => m.message.id === item.message.id);
        if (idx >= 0) {
            repo.messages[idx] = item;
        }
        else {
            repo.messages.push(item);
        }
        repo.headId = item.message.id;
        await this.storage.setItem(key, JSON.stringify(repo));
    }
}
const createHistoryProvider = (storage, prefix) => {
    const Provider = ({ children }) => {
        const aui = useAui();
        const history = useMemo(() => new AsyncStorageHistoryAdapter(storage, aui, prefix), [aui]);
        const adapters = useMemo(() => ({ history }), [history]);
        return (_jsx(RuntimeAdapterProvider, { adapters: adapters, children: children }));
    };
    return Provider;
};
export const createLocalStorageAdapter = (options) => {
    const { storage, prefix = "@assistant-ui:", titleGenerator } = options;
    const threadsKey = `${prefix}threads`;
    const messagesKey = (threadId) => `${prefix}messages:${threadId}`;
    const loadThreadMetadata = async () => {
        const raw = await storage.getItem(threadsKey);
        return raw ? JSON.parse(raw) : [];
    };
    const saveThreadMetadata = async (threads) => {
        await storage.setItem(threadsKey, JSON.stringify(threads));
    };
    const adapter = {
        unstable_Provider: createHistoryProvider(storage, prefix),
        async list() {
            const threads = await loadThreadMetadata();
            return {
                threads: threads.map((t) => ({
                    remoteId: t.remoteId,
                    externalId: t.externalId,
                    status: t.status,
                    title: t.title,
                })),
            };
        },
        async initialize(threadId) {
            const remoteId = threadId;
            const threads = await loadThreadMetadata();
            // Only add if not already present
            if (!threads.some((t) => t.remoteId === remoteId)) {
                threads.unshift({
                    remoteId,
                    status: "regular",
                });
                await saveThreadMetadata(threads);
            }
            return { remoteId, externalId: undefined };
        },
        async rename(remoteId, newTitle) {
            const threads = await loadThreadMetadata();
            const thread = threads.find((t) => t.remoteId === remoteId);
            if (thread) {
                thread.title = newTitle;
                await saveThreadMetadata(threads);
            }
        },
        async archive(remoteId) {
            const threads = await loadThreadMetadata();
            const thread = threads.find((t) => t.remoteId === remoteId);
            if (thread) {
                thread.status = "archived";
                await saveThreadMetadata(threads);
            }
        },
        async unarchive(remoteId) {
            const threads = await loadThreadMetadata();
            const thread = threads.find((t) => t.remoteId === remoteId);
            if (thread) {
                thread.status = "regular";
                await saveThreadMetadata(threads);
            }
        },
        async delete(remoteId) {
            const threads = await loadThreadMetadata();
            const filtered = threads.filter((t) => t.remoteId !== remoteId);
            await saveThreadMetadata(filtered);
            await storage.removeItem(messagesKey(remoteId));
        },
        async fetch(threadId) {
            const threads = await loadThreadMetadata();
            const thread = threads.find((t) => t.remoteId === threadId);
            if (!thread)
                throw new Error("Thread not found");
            return {
                remoteId: thread.remoteId,
                externalId: thread.externalId,
                status: thread.status,
                title: thread.title,
            };
        },
        async generateTitle(remoteId, messages) {
            if (titleGenerator) {
                const title = await titleGenerator.generateTitle(messages);
                // Update the stored title
                const threads = await loadThreadMetadata();
                const thread = threads.find((t) => t.remoteId === remoteId);
                if (thread) {
                    thread.title = title;
                    await saveThreadMetadata(threads);
                }
                // Return a stream with a single text part
                return createAssistantStream((controller) => {
                    controller.appendText(title);
                });
            }
            // No title generator — return empty stream
            return createAssistantStream(() => { });
        },
    };
    return adapter;
};
//# sourceMappingURL=LocalStorageThreadListAdapter.js.map