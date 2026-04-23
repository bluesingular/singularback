import { resource, tapState, withKey } from "@assistant-ui/tap";
import { tapClientLookup } from "@assistant-ui/store";
const SuggestionClient = resource((state) => {
    return {
        getState: () => state,
    };
});
const SuggestionsResource = resource((suggestions) => {
    const [state] = tapState(() => {
        const normalizedSuggestions = (suggestions ?? []).map((s) => {
            if (typeof s === "string") {
                return {
                    title: s,
                    label: "",
                    prompt: s,
                };
            }
            return {
                title: s.title,
                label: s.label,
                prompt: s.prompt,
            };
        });
        return {
            suggestions: normalizedSuggestions,
        };
    });
    const suggestionClients = tapClientLookup(() => state.suggestions.map((suggestion, index) => withKey(index, SuggestionClient(suggestion))), [state.suggestions]);
    return {
        getState: () => state,
        suggestion: ({ index }) => {
            return suggestionClients.get({ index });
        },
    };
});
export const Suggestions = SuggestionsResource;
//# sourceMappingURL=suggestions.js.map