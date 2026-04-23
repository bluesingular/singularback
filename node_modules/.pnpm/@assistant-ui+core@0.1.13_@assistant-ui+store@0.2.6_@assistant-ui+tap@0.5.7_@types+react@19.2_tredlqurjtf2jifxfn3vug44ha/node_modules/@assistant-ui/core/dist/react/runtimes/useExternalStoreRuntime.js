"use client";
import { useEffect, useMemo, useState } from "react";
import { ExternalStoreRuntimeCore } from "../../runtimes/internal.js";
import { AssistantRuntimeImpl } from "../../runtime/internal.js";
import { useRuntimeAdapters } from "./RuntimeAdapterProvider.js";
export const useExternalStoreRuntime = (store) => {
    const [runtime] = useState(() => new ExternalStoreRuntimeCore(store));
    useEffect(() => {
        runtime.setAdapter(store);
    });
    const { modelContext } = useRuntimeAdapters() ?? {};
    useEffect(() => {
        if (!modelContext)
            return undefined;
        return runtime.registerModelContextProvider(modelContext);
    }, [modelContext, runtime]);
    return useMemo(() => new AssistantRuntimeImpl(runtime), [runtime]);
};
//# sourceMappingURL=useExternalStoreRuntime.js.map