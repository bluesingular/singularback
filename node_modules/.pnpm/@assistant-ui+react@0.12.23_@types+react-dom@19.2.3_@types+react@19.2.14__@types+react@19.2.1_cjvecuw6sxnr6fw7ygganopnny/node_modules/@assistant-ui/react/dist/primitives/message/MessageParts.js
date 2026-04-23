"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MessagePrimitiveParts as MessagePrimitivePartsBase, MessagePartComponent as MessagePartComponentBase, MessagePrimitivePartByIndex as MessagePrimitivePartByIndexBase, messagePartsDefaultComponents, } from "@assistant-ui/core/react";
import { MessagePartPrimitiveText } from "../messagePart/MessagePartText.js";
import { MessagePartPrimitiveImage } from "../messagePart/MessagePartImage.js";
import { MessagePartPrimitiveInProgress } from "../messagePart/MessagePartInProgress.js";
const webDefaultComponents = {
    ...messagePartsDefaultComponents,
    Text: () => (_jsxs("p", { style: { whiteSpace: "pre-line" }, children: [_jsx(MessagePartPrimitiveText, {}), _jsx(MessagePartPrimitiveInProgress, { children: _jsx("span", { style: { fontFamily: "revert" }, children: " \u25CF" }) })] })),
    Image: () => _jsx(MessagePartPrimitiveImage, {}),
};
/**
 * Renders the parts of a message with web-specific default components.
 */
export const MessagePrimitiveParts = (props) => {
    if ("children" in props) {
        return (_jsx(MessagePrimitivePartsBase, { children: props.children }));
    }
    const { components, ...rest } = props;
    const merged = components
        ? {
            Text: components.Text ?? webDefaultComponents.Text,
            Image: components.Image ?? webDefaultComponents.Image,
            Reasoning: components.Reasoning ?? messagePartsDefaultComponents.Reasoning,
            Source: components.Source ?? messagePartsDefaultComponents.Source,
            File: components.File ?? messagePartsDefaultComponents.File,
            Unstable_Audio: components.Unstable_Audio ??
                messagePartsDefaultComponents.Unstable_Audio,
            ...("ChainOfThought" in components
                ? { ChainOfThought: components.ChainOfThought }
                : {
                    tools: components.tools,
                    data: components.data,
                    ToolGroup: components.ToolGroup ?? messagePartsDefaultComponents.ToolGroup,
                    ReasoningGroup: components.ReasoningGroup ??
                        messagePartsDefaultComponents.ReasoningGroup,
                }),
            Empty: components.Empty,
            Quote: components.Quote,
        }
        : webDefaultComponents;
    return _jsx(MessagePrimitivePartsBase, { components: merged, ...rest });
};
MessagePrimitiveParts.displayName = "MessagePrimitive.Parts";
// Re-export everything else unchanged
export { MessagePartComponentBase as MessagePartComponent, MessagePrimitivePartByIndexBase as MessagePrimitivePartByIndex, };
//# sourceMappingURL=MessageParts.js.map