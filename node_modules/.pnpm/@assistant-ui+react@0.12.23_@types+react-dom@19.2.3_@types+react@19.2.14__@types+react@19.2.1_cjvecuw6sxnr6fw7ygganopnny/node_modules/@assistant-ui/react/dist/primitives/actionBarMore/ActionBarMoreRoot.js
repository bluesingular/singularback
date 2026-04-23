"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useRef } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { useDropdownMenuScope } from "./scope.js";
import { useActionBarInteractionContext } from "../actionBar/ActionBarInteractionContext.js";
export const ActionBarMorePrimitiveRoot = ({ __scopeActionBarMore, open, onOpenChange, ...rest }) => {
    const scope = useDropdownMenuScope(__scopeActionBarMore);
    const actionBarInteraction = useActionBarInteractionContext();
    const releaseInteractionLockRef = useRef(null);
    const isControlled = open !== undefined;
    const setInteractionOpen = useCallback((nextOpen) => {
        if (nextOpen) {
            if (releaseInteractionLockRef.current)
                return;
            releaseInteractionLockRef.current =
                actionBarInteraction?.acquireInteractionLock() ?? null;
            return;
        }
        releaseInteractionLockRef.current?.();
        releaseInteractionLockRef.current = null;
    }, [actionBarInteraction]);
    const handleOpenChange = useCallback((nextOpen) => {
        if (!isControlled) {
            setInteractionOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    }, [isControlled, setInteractionOpen, onOpenChange]);
    useEffect(() => {
        if (!isControlled)
            return;
        setInteractionOpen(Boolean(open));
    }, [isControlled, open, setInteractionOpen]);
    useEffect(() => {
        return () => {
            releaseInteractionLockRef.current?.();
            releaseInteractionLockRef.current = null;
        };
    }, []);
    return (_jsx(DropdownMenuPrimitive.Root, { ...scope, ...rest, ...(open !== undefined ? { open } : null), onOpenChange: handleOpenChange }));
};
ActionBarMorePrimitiveRoot.displayName = "ActionBarMorePrimitive.Root";
//# sourceMappingURL=ActionBarMoreRoot.js.map