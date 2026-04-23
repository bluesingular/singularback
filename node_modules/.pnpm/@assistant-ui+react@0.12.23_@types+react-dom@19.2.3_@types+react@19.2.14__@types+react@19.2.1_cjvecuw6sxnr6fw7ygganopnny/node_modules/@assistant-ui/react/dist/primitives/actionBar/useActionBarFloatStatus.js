"use client";
import { useAuiState } from "@assistant-ui/store";
export var HideAndFloatStatus;
(function (HideAndFloatStatus) {
    HideAndFloatStatus["Hidden"] = "hidden";
    HideAndFloatStatus["Floating"] = "floating";
    HideAndFloatStatus["Normal"] = "normal";
})(HideAndFloatStatus || (HideAndFloatStatus = {}));
export const useActionBarFloatStatus = ({ hideWhenRunning, autohide, autohideFloat, forceVisible, }) => {
    return useAuiState((s) => {
        if (hideWhenRunning && s.thread.isRunning)
            return HideAndFloatStatus.Hidden;
        const autohideEnabled = autohide === "always" || (autohide === "not-last" && !s.message.isLast);
        const isVisibleByInteraction = forceVisible || s.message.isHovering;
        // normal status
        if (!autohideEnabled)
            return HideAndFloatStatus.Normal;
        // hidden status
        if (!isVisibleByInteraction)
            return HideAndFloatStatus.Hidden;
        // floating status
        if (autohideFloat === "always" ||
            (autohideFloat === "single-branch" && s.message.branchCount <= 1))
            return HideAndFloatStatus.Floating;
        return HideAndFloatStatus.Normal;
    });
};
//# sourceMappingURL=useActionBarFloatStatus.js.map