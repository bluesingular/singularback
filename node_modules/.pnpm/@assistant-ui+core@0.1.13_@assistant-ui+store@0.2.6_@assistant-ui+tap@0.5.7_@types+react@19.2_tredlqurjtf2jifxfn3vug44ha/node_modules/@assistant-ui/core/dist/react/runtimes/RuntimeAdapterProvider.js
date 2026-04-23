import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from "react";
const RuntimeAdaptersContext = createContext(null);
export const RuntimeAdapterProvider = ({ adapters, children, }) => {
    const context = useContext(RuntimeAdaptersContext);
    return (_jsx(RuntimeAdaptersContext.Provider, { value: {
            ...context,
            ...adapters,
        }, children: children }));
};
export const useRuntimeAdapters = () => {
    return useContext(RuntimeAdaptersContext);
};
//# sourceMappingURL=RuntimeAdapterProvider.js.map