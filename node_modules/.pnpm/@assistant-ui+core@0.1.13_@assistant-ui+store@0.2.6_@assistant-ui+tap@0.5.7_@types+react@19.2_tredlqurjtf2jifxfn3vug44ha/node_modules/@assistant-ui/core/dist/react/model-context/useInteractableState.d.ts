type StateUpdater<TState> = TState | ((prev: TState) => TState);
/**
 * Reads and writes the state of a registered interactable.
 *
 * Pair with {@link useAssistantInteractable} which handles registration.
 */
export declare const useInteractableState: <TState>(id: string, fallback: TState) => [TState, {
    setState: (updater: StateUpdater<TState>) => void;
    setSelected: (selected: boolean) => void;
    isPending: boolean;
    error: unknown;
    flush: () => Promise<void>;
}];
export {};
//# sourceMappingURL=useInteractableState.d.ts.map