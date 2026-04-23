import { ResourceElement } from "./core/types.js";
export declare namespace tapResourceRoot {
    type Unsubscribe = () => void;
    interface SubscribableResource<TState> {
        /**
         * Get the current state of the store.
         */
        getValue(): TState;
        /**
         * Subscribe to the store.
         */
        subscribe(listener: () => void): Unsubscribe;
    }
}
export declare const tapResourceRoot: <TState>(element: ResourceElement<TState>) => tapResourceRoot.SubscribableResource<TState>;
//# sourceMappingURL=tapResourceRoot.d.ts.map