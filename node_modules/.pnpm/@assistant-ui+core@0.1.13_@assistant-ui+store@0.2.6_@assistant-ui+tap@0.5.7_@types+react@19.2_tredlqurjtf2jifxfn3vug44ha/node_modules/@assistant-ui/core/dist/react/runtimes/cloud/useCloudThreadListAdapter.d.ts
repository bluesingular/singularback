import { AssistantCloud } from "assistant-cloud";
import type { RemoteThreadListAdapter } from "../../../runtimes/remote-thread-list/types.js";
type ThreadData = {
    externalId: string | undefined;
};
type CloudThreadListAdapterOptions = {
    cloud?: AssistantCloud | undefined;
    create?: (() => Promise<ThreadData>) | undefined;
    delete?: ((threadId: string) => Promise<void>) | undefined;
};
export declare const useCloudThreadListAdapter: (adapter: CloudThreadListAdapterOptions) => RemoteThreadListAdapter;
export {};
//# sourceMappingURL=useCloudThreadListAdapter.d.ts.map