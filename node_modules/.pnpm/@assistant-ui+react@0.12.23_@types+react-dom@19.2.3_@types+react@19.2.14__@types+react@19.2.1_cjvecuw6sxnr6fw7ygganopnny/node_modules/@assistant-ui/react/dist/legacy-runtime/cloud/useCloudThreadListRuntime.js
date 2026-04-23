"use client";
import { useRemoteThreadListRuntime } from "../runtime-cores/remote-thread-list/useRemoteThreadListRuntime.js";
import { useCloudThreadListAdapter } from "../runtime-cores/remote-thread-list/adapter/cloud.js";
export function useCloudThreadListRuntime({ runtimeHook, ...adapterOptions }) {
    const adapter = useCloudThreadListAdapter(adapterOptions);
    return useRemoteThreadListRuntime({
        runtimeHook,
        adapter,
        allowNesting: true,
    });
}
//# sourceMappingURL=useCloudThreadListRuntime.js.map