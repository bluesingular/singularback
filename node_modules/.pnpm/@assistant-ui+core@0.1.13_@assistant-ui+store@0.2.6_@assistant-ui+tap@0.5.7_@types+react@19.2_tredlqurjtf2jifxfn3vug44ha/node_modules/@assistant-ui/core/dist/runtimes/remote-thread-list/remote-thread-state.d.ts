import type { RemoteThreadInitializeResponse } from "./types.js";
export type RemoteThreadData = {
    readonly id: string;
    readonly remoteId: undefined;
    readonly externalId: undefined;
    readonly status: "new";
    readonly title: undefined;
} | {
    readonly id: string;
    readonly initializeTask: Promise<RemoteThreadInitializeResponse>;
    readonly remoteId: undefined;
    readonly externalId: undefined;
    readonly status: "regular" | "archived";
    readonly title?: string | undefined;
} | {
    readonly id: string;
    readonly initializeTask: Promise<RemoteThreadInitializeResponse>;
    readonly remoteId: string;
    readonly externalId: string | undefined;
    readonly status: "regular" | "archived";
    readonly title?: string | undefined;
};
export type THREAD_MAPPING_ID = string & {
    __brand: "THREAD_MAPPING_ID";
};
export declare function createThreadMappingId(id: string): THREAD_MAPPING_ID;
export type RemoteThreadState = {
    readonly isLoading: boolean;
    readonly newThreadId: string | undefined;
    readonly threadIds: readonly string[];
    readonly archivedThreadIds: readonly string[];
    readonly threadIdMap: Readonly<Record<string, THREAD_MAPPING_ID>>;
    readonly threadData: Readonly<Record<THREAD_MAPPING_ID, RemoteThreadData>>;
};
export declare const getThreadData: (state: RemoteThreadState, threadIdOrRemoteId: string) => RemoteThreadData | undefined;
export declare const updateStatusReducer: (state: RemoteThreadState, threadIdOrRemoteId: string, newStatus: "regular" | "archived" | "deleted") => RemoteThreadState;
//# sourceMappingURL=remote-thread-state.d.ts.map