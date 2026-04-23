"use client";
import { createActionButton, } from "../../utils/createActionButton.js";
import { useCallback } from "react";
import { useAui } from "@assistant-ui/store";
import { useComposerAddAttachment as useComposerAddAttachmentBehavior } from "@assistant-ui/core/react";
const useComposerAddAttachment = ({ multiple = true, } = {}) => {
    const { disabled, addAttachment } = useComposerAddAttachmentBehavior();
    const aui = useAui();
    const callback = useCallback(() => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = multiple;
        input.hidden = true;
        const attachmentAccept = aui.composer().getState().attachmentAccept;
        if (attachmentAccept !== "*") {
            input.accept = attachmentAccept;
        }
        document.body.appendChild(input);
        input.onchange = (e) => {
            const fileList = e.target.files;
            if (!fileList)
                return;
            for (const file of fileList) {
                addAttachment(file);
            }
            document.body.removeChild(input);
        };
        input.oncancel = () => {
            if (!input.files || input.files.length === 0) {
                document.body.removeChild(input);
            }
        };
        input.click();
    }, [aui, multiple, addAttachment]);
    if (disabled)
        return null;
    return callback;
};
export const ComposerPrimitiveAddAttachment = createActionButton("ComposerPrimitive.AddAttachment", useComposerAddAttachment, ["multiple"]);
//# sourceMappingURL=ComposerAddAttachment.js.map