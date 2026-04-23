import type { ThreadMessage } from "../../types/message.js";
import type { ClientOutput } from "@assistant-ui/store";
export type ThreadMessageClientProps = {
    message: ThreadMessage;
    index: number;
    isLast?: boolean;
    branchNumber?: number;
    branchCount?: number;
};
export declare const ThreadMessageClient: (props: ThreadMessageClientProps) => import("@assistant-ui/tap").ResourceElement<ClientOutput<"message">, ThreadMessageClientProps>;
//# sourceMappingURL=thread-message-client.d.ts.map