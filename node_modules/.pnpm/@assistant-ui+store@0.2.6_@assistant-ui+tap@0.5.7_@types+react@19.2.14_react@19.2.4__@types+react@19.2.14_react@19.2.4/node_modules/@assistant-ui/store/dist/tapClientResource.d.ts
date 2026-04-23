import { type ResourceElement } from "@assistant-ui/tap";
import type { ClientMethods } from "./types/client.js";
export declare const getClientState: (client: ClientMethods) => any;
type InferClientState<TMethods> = TMethods extends {
    getState: () => infer S;
} ? S : undefined;
export declare const tapClientResource: <TMethods extends ClientMethods>(element: ResourceElement<TMethods>) => {
    state: InferClientState<TMethods>;
    methods: TMethods;
    key: string | number | undefined;
};
export {};
//# sourceMappingURL=tapClientResource.d.ts.map