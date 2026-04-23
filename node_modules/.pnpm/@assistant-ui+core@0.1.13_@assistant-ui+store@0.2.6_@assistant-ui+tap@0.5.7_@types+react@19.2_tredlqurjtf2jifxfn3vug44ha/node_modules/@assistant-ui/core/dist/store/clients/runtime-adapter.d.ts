import type { AssistantRuntime } from "../../runtime/api/assistant-runtime.js";
import { type ScopesConfig, type AssistantClient } from "@assistant-ui/store";
export declare const RuntimeAdapterResource: (props: AssistantRuntime) => import("@assistant-ui/tap").ResourceElement<import("@assistant-ui/store").ClientOutput<"threads">, AssistantRuntime>;
export declare const baseRuntimeAdapterTransformScopes: (scopes: ScopesConfig, parent: AssistantClient) => void;
//# sourceMappingURL=runtime-adapter.d.ts.map