import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useState, } from "react";
import { useAui, AuiProvider, Derived } from "@assistant-ui/store";
import { ReadonlyThreadRuntimeCore } from "../../runtimes/readonly/ReadonlyThreadRuntimeCore.js";
import { ThreadRuntimeImpl, } from "../../runtime/internal.js";
import { ThreadClient } from "../../store/runtime-clients/thread-runtime-client.js";
const READONLY_THREAD_PATH = Object.freeze({
    ref: "readonly-thread",
    threadSelector: { type: "main" },
});
const READONLY_THREAD_LIST_ITEM = Object.freeze({
    id: "readonly",
    remoteId: undefined,
    externalId: undefined,
    isMain: true,
    status: "regular",
    title: undefined,
});
const READONLY_THREAD_LIST_ITEM_BINDING = Object.freeze({
    path: READONLY_THREAD_PATH,
    getState: () => READONLY_THREAD_LIST_ITEM,
    subscribe: () => () => { },
});
export const ReadonlyThreadProvider = ({ messages, children, }) => {
    const [core] = useState(() => {
        const c = new ReadonlyThreadRuntimeCore();
        c.setMessages(messages);
        return c;
    });
    useEffect(() => {
        core.setMessages(messages);
    }, [core, messages]);
    const threadRuntime = useMemo(() => {
        const threadBinding = {
            path: READONLY_THREAD_PATH,
            getState: () => core,
            subscribe: (callback) => core.subscribe(callback),
            outerSubscribe: (callback) => core.subscribe(callback),
        };
        return new ThreadRuntimeImpl(threadBinding, READONLY_THREAD_LIST_ITEM_BINDING);
    }, [core]);
    const aui = useAui({
        thread: ThreadClient({ runtime: threadRuntime }),
        composer: Derived({
            source: "thread",
            query: {},
            get: (aui) => aui.thread().composer(),
        }),
    });
    return _jsx(AuiProvider, { value: aui, children: children });
};
//# sourceMappingURL=ReadonlyThreadProvider.js.map