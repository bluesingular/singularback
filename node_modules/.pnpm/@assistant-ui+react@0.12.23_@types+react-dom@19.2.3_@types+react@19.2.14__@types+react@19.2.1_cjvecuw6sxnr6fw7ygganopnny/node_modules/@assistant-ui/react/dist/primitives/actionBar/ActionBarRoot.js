"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Primitive } from "../../utils/Primitive.js";
import { forwardRef, useCallback, useMemo, useState, } from "react";
import { useActionBarFloatStatus, HideAndFloatStatus, } from "./useActionBarFloatStatus.js";
import { ActionBarInteractionContext } from "./ActionBarInteractionContext.js";
/**
 * The root container for action bar components.
 *
 * This component provides intelligent visibility and floating behavior for action bars,
 * automatically hiding and showing based on message state, hover status, and configuration.
 * It supports floating mode for better UX when space is limited.
 *
 * @example
 * ```tsx
 * <ActionBarPrimitive.Root
 *   hideWhenRunning={true}
 *   autohide="not-last"
 *   autohideFloat="single-branch"
 * >
 *   <ActionBarPrimitive.Copy />
 *   <ActionBarPrimitive.Edit />
 *   <ActionBarPrimitive.Reload />
 * </ActionBarPrimitive.Root>
 * ```
 */
export const ActionBarPrimitiveRoot = forwardRef(({ hideWhenRunning, autohide, autohideFloat, ...rest }, ref) => {
    const [interactionCount, setInteractionCount] = useState(0);
    const acquireInteractionLock = useCallback(() => {
        let released = false;
        setInteractionCount((count) => count + 1);
        return () => {
            if (released)
                return;
            released = true;
            setInteractionCount((count) => Math.max(0, count - 1));
        };
    }, []);
    const interactionContext = useMemo(() => ({ acquireInteractionLock }), [acquireInteractionLock]);
    const hideAndfloatStatus = useActionBarFloatStatus({
        hideWhenRunning,
        autohide,
        autohideFloat,
        forceVisible: interactionCount > 0,
    });
    if (hideAndfloatStatus === HideAndFloatStatus.Hidden)
        return null;
    return (_jsx(ActionBarInteractionContext.Provider, { value: interactionContext, children: _jsx(Primitive.div, { ...(hideAndfloatStatus === HideAndFloatStatus.Floating
                ? { "data-floating": "true" }
                : null), ...rest, ref: ref }) }));
});
ActionBarPrimitiveRoot.displayName = "ActionBarPrimitive.Root";
//# sourceMappingURL=ActionBarRoot.js.map