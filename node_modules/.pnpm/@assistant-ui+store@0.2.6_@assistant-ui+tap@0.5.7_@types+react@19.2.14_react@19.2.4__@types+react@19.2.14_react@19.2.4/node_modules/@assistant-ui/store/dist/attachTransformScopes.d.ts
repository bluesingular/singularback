import type { ResourceElement } from "@assistant-ui/tap";
import type { AssistantClient, ClientElement, ClientNames } from "./types/client.js";
import type { DerivedElement } from "./Derived.js";
export type ScopesConfig = {
    [K in ClientNames]?: ClientElement<K> | DerivedElement<K>;
};
type TransformScopesFn = (scopes: ScopesConfig, parent: AssistantClient) => void;
export declare function attachTransformScopes<T extends (...args: any[]) => ResourceElement<any>>(resource: T, transform: TransformScopesFn): void;
export declare function forwardTransformScopes<T extends (...args: any[]) => ResourceElement<any>, S extends (...args: any[]) => ResourceElement<any>>(target: T, source: S): void;
export declare function getTransformScopes<T extends (...args: any[]) => ResourceElement<any>>(resource: T): TransformScopesFn | undefined;
export {};
//# sourceMappingURL=attachTransformScopes.d.ts.map