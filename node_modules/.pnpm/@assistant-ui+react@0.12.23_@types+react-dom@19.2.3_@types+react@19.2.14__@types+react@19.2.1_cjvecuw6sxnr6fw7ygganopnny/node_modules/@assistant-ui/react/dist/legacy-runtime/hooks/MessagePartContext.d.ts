import { MessagePartRuntime } from "../runtime/MessagePartRuntime.js";
/**
 * @deprecated Use `useAui()` with `aui.part()` instead. See migration guide: https://assistant-ui.com/docs/migrations/v0-12
 */
export declare function useMessagePartRuntime(options?: {
    optional?: false | undefined;
}): MessagePartRuntime;
export declare function useMessagePartRuntime(options?: {
    optional?: boolean | undefined;
}): MessagePartRuntime | null;
/**
 * @deprecated Use `useAuiState((s) => s.part)` instead. See migration guide: https://assistant-ui.com/docs/migrations/v0-12
 */
export declare const useMessagePart: {
    (): import("@assistant-ui/core").MessagePartState;
    <TSelected>(selector: (state: import("@assistant-ui/core").MessagePartState) => TSelected): TSelected;
    <TSelected>(selector: ((state: import("@assistant-ui/core").MessagePartState) => TSelected) | undefined): import("@assistant-ui/core").MessagePartState | TSelected;
    (options: {
        optional?: false | undefined;
    }): import("@assistant-ui/core").MessagePartState;
    (options: {
        optional?: boolean | undefined;
    }): import("@assistant-ui/core").MessagePartState | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: import("@assistant-ui/core").MessagePartState) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: import("@assistant-ui/core").MessagePartState) => TSelected) | undefined;
    }): import("@assistant-ui/core").MessagePartState | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: import("@assistant-ui/core").MessagePartState) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: import("@assistant-ui/core").MessagePartState) => TSelected) | undefined;
    }): import("@assistant-ui/core").MessagePartState | TSelected | null;
};
//# sourceMappingURL=MessagePartContext.d.ts.map