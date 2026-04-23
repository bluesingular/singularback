import { jsx as _jsx } from "react/jsx-runtime";
import { memo, useMemo, } from "react";
import { RenderChildrenWithAccessor, useAuiState } from "@assistant-ui/store";
import { SuggestionByIndexProvider } from "../../providers/SuggestionByIndexProvider.js";
const SuggestionComponent = ({ components }) => {
    const Component = components.Suggestion;
    return _jsx(Component, {});
};
/**
 * Renders a single suggestion at the specified index.
 */
export const ThreadPrimitiveSuggestionByIndex = memo(({ index, components }) => {
    return (_jsx(SuggestionByIndexProvider, { index: index, children: _jsx(SuggestionComponent, { components: components }) }));
}, (prev, next) => prev.index === next.index &&
    prev.components.Suggestion === next.components.Suggestion);
ThreadPrimitiveSuggestionByIndex.displayName =
    "ThreadPrimitive.SuggestionByIndex";
const ThreadPrimitiveSuggestionsInner = ({ children }) => {
    const suggestionsLength = useAuiState((s) => s.suggestions.suggestions.length);
    return useMemo(() => {
        if (suggestionsLength === 0)
            return null;
        return Array.from({ length: suggestionsLength }, (_, index) => (_jsx(SuggestionByIndexProvider, { index: index, children: _jsx(RenderChildrenWithAccessor, { getItemState: (aui) => aui.suggestions().suggestion({ index }).getState(), children: (getItem) => children({
                    get suggestion() {
                        return getItem();
                    },
                }) }) }, index)));
    }, [suggestionsLength, children]);
};
/**
 * Renders all suggestions.
 */
export const ThreadPrimitiveSuggestionsImpl = ({ components, children }) => {
    if (components) {
        return (_jsx(ThreadPrimitiveSuggestionsInner, { children: () => _jsx(SuggestionComponent, { components: components }) }));
    }
    return (_jsx(ThreadPrimitiveSuggestionsInner, { children: children }));
};
ThreadPrimitiveSuggestionsImpl.displayName = "ThreadPrimitive.Suggestions";
export const ThreadPrimitiveSuggestions = memo(ThreadPrimitiveSuggestionsImpl, (prev, next) => {
    if (prev.children || next.children) {
        return prev.children === next.children;
    }
    return prev.components.Suggestion === next.components.Suggestion;
});
//# sourceMappingURL=ThreadSuggestions.js.map