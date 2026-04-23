import { resource, tapState, tapCallback } from "@assistant-ui/tap";
export const DataRenderers = resource(() => {
    const [state, setState] = tapState(() => ({
        renderers: {},
    }));
    const setDataUI = tapCallback((name, render) => {
        setState((prev) => {
            return {
                ...prev,
                renderers: {
                    ...prev.renderers,
                    [name]: [...(prev.renderers[name] ?? []), render],
                },
            };
        });
        return () => {
            setState((prev) => {
                return {
                    ...prev,
                    renderers: {
                        ...prev.renderers,
                        [name]: prev.renderers[name]?.filter((r) => r !== render) ?? [],
                    },
                };
            });
        };
    }, []);
    return {
        getState: () => state,
        setDataUI,
    };
});
//# sourceMappingURL=DataRenderers.js.map