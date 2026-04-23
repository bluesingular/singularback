import { FC, ReactNode } from "react";
import type { ThreadHistoryAdapter } from "../../adapters/thread-history.js";
import type { AttachmentAdapter } from "../../adapters/attachment.js";
import type { ModelContextProvider } from "../../model-context/types.js";
export type RuntimeAdapters = {
    modelContext?: ModelContextProvider | undefined;
    history?: ThreadHistoryAdapter | undefined;
    attachments?: AttachmentAdapter | undefined;
};
export declare namespace RuntimeAdapterProvider {
    type Props = {
        adapters: RuntimeAdapters;
        children: ReactNode;
    };
}
export declare const RuntimeAdapterProvider: FC<RuntimeAdapterProvider.Props>;
export declare const useRuntimeAdapters: () => RuntimeAdapters | null;
//# sourceMappingURL=RuntimeAdapterProvider.d.ts.map