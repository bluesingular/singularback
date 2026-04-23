import { ThreadListItemRuntime } from "../runtime/ThreadListItemRuntime.js";
/**
 * @deprecated Use `useAui()` with `aui.threadListItem()` instead. See migration guide: https://assistant-ui.com/docs/migrations/v0-12
 */
export declare function useThreadListItemRuntime(options?: {
    optional?: false | undefined;
}): ThreadListItemRuntime;
export declare function useThreadListItemRuntime(options?: {
    optional?: boolean | undefined;
}): ThreadListItemRuntime | null;
/**
 * @deprecated Use `useAuiState((s) => s.threadListItem)` instead. See migration guide: https://assistant-ui.com/docs/migrations/v0-12
 */
export declare const useThreadListItem: {
    (): import("@assistant-ui/core").ThreadListItemState;
    <TSelected>(selector: (state: import("@assistant-ui/core").ThreadListItemState) => TSelected): TSelected;
    <TSelected>(selector: ((state: import("@assistant-ui/core").ThreadListItemState) => TSelected) | undefined): import("@assistant-ui/core").ThreadListItemState | TSelected;
    (options: {
        optional?: false | undefined;
    }): import("@assistant-ui/core").ThreadListItemState;
    (options: {
        optional?: boolean | undefined;
    }): import("@assistant-ui/core").ThreadListItemState | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: import("@assistant-ui/core").ThreadListItemState) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: import("@assistant-ui/core").ThreadListItemState) => TSelected) | undefined;
    }): import("@assistant-ui/core").ThreadListItemState | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: import("@assistant-ui/core").ThreadListItemState) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: import("@assistant-ui/core").ThreadListItemState) => TSelected) | undefined;
    }): import("@assistant-ui/core").ThreadListItemState | TSelected | null;
};
//# sourceMappingURL=ThreadListItemContext.d.ts.map