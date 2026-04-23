export declare enum HideAndFloatStatus {
    Hidden = "hidden",
    Floating = "floating",
    Normal = "normal"
}
export type UseActionBarFloatStatusProps = {
    hideWhenRunning?: boolean | undefined;
    autohide?: "always" | "not-last" | "never" | undefined;
    autohideFloat?: "always" | "single-branch" | "never" | undefined;
    forceVisible?: boolean | undefined;
};
export declare const useActionBarFloatStatus: ({ hideWhenRunning, autohide, autohideFloat, forceVisible, }: UseActionBarFloatStatusProps) => HideAndFloatStatus;
//# sourceMappingURL=useActionBarFloatStatus.d.ts.map