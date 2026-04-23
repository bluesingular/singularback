import { resource, tapState, tapEffect, tapCallback, tapRef, tapMemo, } from "@assistant-ui/tap";
import { tapAssistantClientRef, attachTransformScopes, } from "@assistant-ui/store";
import { toJSONSchema, toPartialJSONSchema } from "assistant-stream";
import { ModelContext } from "../../store/index.js";
import { buildInteractableModelContext } from "./interactable-model-context.js";
const PERSISTENCE_DEBOUNCE_MS = 500;
export const Interactables = resource(() => {
    const [state, setState] = tapState(() => ({
        definitions: {},
        persistence: {},
    }));
    const clientRef = tapAssistantClientRef();
    const stateRef = tapRef(state);
    tapEffect(() => {
        stateRef.current = state;
    }, [state]);
    const subscribersRef = tapRef(new Set());
    const partialSchemaCacheRef = tapRef(new Map());
    const detachedStateRef = tapRef(new Map());
    const adapterRef = tapRef(undefined);
    const debounceTimerRef = tapRef(undefined);
    const syncSeqRef = tapRef(0);
    const hasPendingLocalChangeRef = tapRef(false);
    const flushResolversRef = tapRef([]);
    const dirtyIdsRef = tapRef(new Set());
    const runPersistence = tapCallback(async () => {
        const adapter = adapterRef.current;
        if (!adapter) {
            for (const resolve of flushResolversRef.current)
                resolve();
            flushResolversRef.current = [];
            return;
        }
        const seq = ++syncSeqRef.current;
        const dirtyIds = new Set(dirtyIdsRef.current);
        dirtyIdsRef.current.clear();
        hasPendingLocalChangeRef.current = true;
        // Snapshot before any await so unregistered definitions are still included.
        const exported = stateRef.current.definitions;
        const payload = {};
        for (const [id, def] of Object.entries(exported)) {
            payload[id] = { name: def.name, state: def.state };
        }
        setState((prev) => ({
            ...prev,
            persistence: {
                ...prev.persistence,
                ...Object.fromEntries([...dirtyIds].map((id) => [
                    id,
                    { isPending: true, error: undefined },
                ])),
            },
        }));
        try {
            await adapter.save(payload);
            if (syncSeqRef.current === seq) {
                hasPendingLocalChangeRef.current = false;
                setState((prev) => {
                    const persistence = { ...prev.persistence };
                    for (const id of dirtyIds)
                        delete persistence[id];
                    return { ...prev, persistence };
                });
            }
        }
        catch (e) {
            if (syncSeqRef.current === seq) {
                hasPendingLocalChangeRef.current = false;
                setState((prev) => ({
                    ...prev,
                    persistence: {
                        ...prev.persistence,
                        ...Object.fromEntries([...dirtyIds].map((id) => [id, { isPending: false, error: e }])),
                    },
                }));
            }
        }
        finally {
            if (dirtyIdsRef.current.size > 0 && adapterRef.current) {
                runPersistence();
            }
            else {
                for (const resolve of flushResolversRef.current)
                    resolve();
                flushResolversRef.current = [];
            }
        }
    }, []);
    const schedulePersistence = tapCallback((id) => {
        if (!adapterRef.current)
            return;
        dirtyIdsRef.current.add(id);
        if (debounceTimerRef.current !== undefined) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = undefined;
            if (!hasPendingLocalChangeRef.current) {
                runPersistence();
            }
            else {
                debounceTimerRef.current = setTimeout(() => {
                    debounceTimerRef.current = undefined;
                    runPersistence();
                }, PERSISTENCE_DEBOUNCE_MS);
            }
        }, PERSISTENCE_DEBOUNCE_MS);
    }, [runPersistence]);
    const exportState = tapCallback(() => {
        const result = {};
        for (const [id, def] of Object.entries(stateRef.current.definitions)) {
            result[id] = { name: def.name, state: def.state };
        }
        return result;
    }, []);
    const importState = tapCallback((saved) => {
        for (const [id, entry] of Object.entries(saved)) {
            detachedStateRef.current.set(id, entry.state);
        }
        setState((prev) => {
            let changed = false;
            const definitions = { ...prev.definitions };
            for (const [id, entry] of Object.entries(saved)) {
                if (definitions[id]) {
                    definitions[id] = { ...definitions[id], state: entry.state };
                    changed = true;
                }
            }
            return changed ? { ...prev, definitions } : prev;
        });
    }, []);
    const setPersistenceAdapter = tapCallback((adapter) => {
        adapterRef.current = adapter;
    }, []);
    const flush = tapCallback(async () => {
        if (debounceTimerRef.current !== undefined) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = undefined;
        }
        if (!adapterRef.current)
            return;
        if (!hasPendingLocalChangeRef.current && dirtyIdsRef.current.size === 0)
            return;
        const p = new Promise((resolve) => {
            flushResolversRef.current.push(resolve);
        });
        if (!hasPendingLocalChangeRef.current) {
            runPersistence();
        }
        return p;
    }, [runPersistence]);
    const flushIfPending = tapCallback(() => {
        if (adapterRef.current && debounceTimerRef.current !== undefined) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = undefined;
            runPersistence();
        }
    }, [runPersistence]);
    const setDefState = tapCallback((id, updater) => {
        setState((prev) => {
            const existing = prev.definitions[id];
            if (!existing)
                return prev;
            return {
                ...prev,
                definitions: {
                    ...prev.definitions,
                    [id]: { ...existing, state: updater(existing.state) },
                },
            };
        });
        if (stateRef.current.definitions[id])
            schedulePersistence(id);
    }, [schedulePersistence]);
    const setDefSelected = tapCallback((id, selected) => {
        setState((prev) => {
            const existing = prev.definitions[id];
            if (!existing)
                return prev;
            return {
                ...prev,
                definitions: {
                    ...prev.definitions,
                    [id]: { ...existing, selected },
                },
            };
        });
    }, []);
    const provider = tapMemo(() => ({
        getModelContext: () => {
            const defs = stateRef.current.definitions;
            return (buildInteractableModelContext(defs, partialSchemaCacheRef.current, setDefState) ?? {});
        },
        subscribe: (callback) => {
            subscribersRef.current.add(callback);
            return () => {
                subscribersRef.current.delete(callback);
            };
        },
    }), [setDefState]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: state dep triggers notification
    tapEffect(() => {
        for (const cb of subscribersRef.current)
            cb();
    }, [state]);
    tapEffect(() => {
        return clientRef.current.modelContext().register(provider);
    }, [clientRef, provider]);
    const register = tapCallback((def) => {
        try {
            const jsonSchema = toJSONSchema(def.stateSchema);
            partialSchemaCacheRef.current.set(def.id, toPartialJSONSchema(jsonSchema));
        }
        catch (e) {
            console.warn(`[Interactables] Failed to create partial schema for "${def.name}". The update tool will require all fields.`, e);
        }
        const detached = detachedStateRef.current.get(def.id);
        detachedStateRef.current.delete(def.id);
        setState((prev) => ({
            ...prev,
            definitions: {
                ...prev.definitions,
                [def.id]: {
                    id: def.id,
                    name: def.name,
                    description: def.description,
                    stateSchema: def.stateSchema,
                    state: prev.definitions[def.id]?.state ?? detached ?? def.initialState,
                    selected: def.selected,
                },
            },
        }));
        return () => {
            flushIfPending();
            setState((prev) => {
                const existing = prev.definitions[def.id];
                if (existing) {
                    detachedStateRef.current.set(def.id, existing.state);
                }
                partialSchemaCacheRef.current.delete(def.id);
                const { [def.id]: _, ...rest } = prev.definitions;
                const { [def.id]: __, ...restPersistence } = prev.persistence;
                return { ...prev, definitions: rest, persistence: restPersistence };
            });
        };
    }, [flushIfPending]);
    return {
        getState: () => state,
        register,
        setState: setDefState,
        setSelected: setDefSelected,
        exportState,
        importState,
        setPersistenceAdapter,
        flush,
    };
});
attachTransformScopes(Interactables, (scopes, parent) => {
    if (!scopes.modelContext && parent.modelContext.source === null) {
        scopes.modelContext = ModelContext();
    }
});
//# sourceMappingURL=Interactables.js.map