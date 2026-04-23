import { type ComponentType, type FC, type PropsWithChildren } from "react";
import { type AssistantClient } from "@assistant-ui/store";
import type { AssistantRuntime } from "../runtime/api/assistant-runtime.js";
export declare const getRenderComponent: (runtime: AssistantRuntime) => ComponentType | undefined;
export type AssistantProviderBaseProps = PropsWithChildren<{
    runtime: AssistantRuntime;
    aui?: AssistantClient | null;
}>;
export declare const AssistantProviderBase: FC<AssistantProviderBaseProps>;
//# sourceMappingURL=AssistantProvider.d.ts.map