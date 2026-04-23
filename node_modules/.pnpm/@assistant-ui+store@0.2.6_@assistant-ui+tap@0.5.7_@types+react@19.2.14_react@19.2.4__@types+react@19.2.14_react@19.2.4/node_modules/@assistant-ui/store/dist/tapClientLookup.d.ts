import { type ResourceElement } from "@assistant-ui/tap";
import type { ClientMethods } from "./types/client.js";
type InferClientState<TMethods> = TMethods extends {
    getState: () => infer S;
} ? S : unknown;
export declare function tapClientLookup<TMethods extends ClientMethods>(getElements: () => readonly ResourceElement<TMethods>[], getElementsDeps: readonly unknown[]): {
    state: InferClientState<TMethods>[];
    get: (lookup: {
        index: number;
    } | {
        key: string;
    }) => TMethods;
};
export {};
//# sourceMappingURL=tapClientLookup.d.ts.map