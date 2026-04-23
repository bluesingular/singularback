import { type ClientOutput } from "@assistant-ui/store";
import type { AppendMessage, ThreadMessage } from "@assistant-ui/core";
import type { QueueItemState } from "@assistant-ui/core/store";
export type ExternalThreadMessage = ThreadMessage & {
    id: string;
};
export type ExternalThreadQueueAdapter = {
    /** The current queue items. */
    items: readonly QueueItemState[];
    /** Called when a message is submitted via the composer. Receives the steer preference. */
    enqueue: (message: AppendMessage, opts: {
        steer: boolean;
    }) => void;
    /** Called to promote an existing queue item (cancel current run, run this immediately). */
    steer: (queueItemId: string) => void;
    /** Called to remove an item from the queue. */
    remove: (queueItemId: string) => void;
    /** Called to clear all pending queue items, with the reason for clearing. */
    clear: (reason: "edit" | "reload" | "cancel-run") => void;
};
export type ExternalThreadProps = {
    messages: readonly ExternalThreadMessage[];
    isRunning?: boolean;
    /**
     * Callback for new messages (non-queue runtimes).
     * @note Unused when `queue` is provided — new messages are routed through `queue.enqueue` instead.
     */
    onNew?: (message: AppendMessage) => void;
    onEdit?: (message: AppendMessage) => void;
    onReload?: (parentId: string | null) => void;
    onStartRun?: () => void;
    onCancel?: () => void;
    /** Queue adapter for runtimes that support message queuing and steering. */
    queue?: ExternalThreadQueueAdapter;
};
export declare const ExternalThread: (props: ExternalThreadProps) => import("@assistant-ui/tap").ResourceElement<ClientOutput<"thread">, ExternalThreadProps>;
//# sourceMappingURL=ExternalThread.d.ts.map