import type { ContravariantResource } from "@assistant-ui/tap";
import type { ClientMethods } from "./types/client.js";
type InferClientState<TMethods> = TMethods extends {
    getState: () => infer S;
} ? S : unknown;
export declare const tapClientList: <TData, TMethods extends ClientMethods>(props: tapClientList.Props<TData, TMethods>) => {
    state: InferClientState<TMethods>[];
    get: (lookup: {
        index: number;
    } | {
        key: string;
    }) => TMethods;
    add: (initialData: TData) => void;
};
export declare namespace tapClientList {
    type ResourceProps<TData> = {
        key: string;
        getInitialData: () => TData;
        remove: () => void;
    };
    type Props<TData, TMethods extends ClientMethods> = {
        initialValues: TData[];
        getKey: (data: TData) => string;
        resource: ContravariantResource<TMethods, ResourceProps<TData>>;
    };
}
export {};
//# sourceMappingURL=tapClientList.d.ts.map