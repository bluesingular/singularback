import { jsx as _jsx } from "react/jsx-runtime";
import { useAui, useAuiState, AuiProvider } from "@assistant-ui/store";
import { ChainOfThoughtClient } from "../../store/clients/chain-of-thought-client.js";
export const ChainOfThoughtByIndicesProvider = ({ startIndex, endIndex, children }) => {
    const parts = useAuiState((s) => s.message.parts).slice(startIndex, endIndex + 1);
    const parentAui = useAui();
    const aui = useAui({
        chainOfThought: ChainOfThoughtClient({
            parts,
            getMessagePart: ({ index }) => {
                if (index < 0 || index >= parts.length) {
                    throw new Error(`ChainOfThought part index ${index} is out of bounds (0..${parts.length - 1})`);
                }
                return parentAui.message().part({ index: startIndex + index });
            },
        }),
    });
    return _jsx(AuiProvider, { value: aui, children: children });
};
//# sourceMappingURL=ChainOfThoughtByIndicesProvider.js.map