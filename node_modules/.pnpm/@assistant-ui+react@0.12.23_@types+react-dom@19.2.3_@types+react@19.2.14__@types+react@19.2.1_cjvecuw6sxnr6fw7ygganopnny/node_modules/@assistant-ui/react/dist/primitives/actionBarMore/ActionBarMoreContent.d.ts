import { ComponentPropsWithoutRef, ComponentRef } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
export declare namespace ActionBarMorePrimitiveContent {
    type Element = ComponentRef<typeof DropdownMenuPrimitive.Content>;
    type Props = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
        portalProps?: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Portal> | undefined;
    };
}
export declare const ActionBarMorePrimitiveContent: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    portalProps?: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Portal> | undefined;
} & import("react").RefAttributes<HTMLDivElement>>;
//# sourceMappingURL=ActionBarMoreContent.d.ts.map