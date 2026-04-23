import { type ClientElement, type ClientOutput } from "@assistant-ui/store";
type SingleThreadListProps = {
    thread: ClientElement<"thread">;
};
/**
 * A minimal threads scope that wraps a single thread.
 * Automatically provided by ExternalThread when no threads scope exists.
 * Mounts the provided thread resource element.
 */
export declare const SingleThreadList: (props: SingleThreadListProps) => import("@assistant-ui/tap").ResourceElement<ClientOutput<"threads">, SingleThreadListProps>;
export {};
//# sourceMappingURL=SingleThreadList.d.ts.map