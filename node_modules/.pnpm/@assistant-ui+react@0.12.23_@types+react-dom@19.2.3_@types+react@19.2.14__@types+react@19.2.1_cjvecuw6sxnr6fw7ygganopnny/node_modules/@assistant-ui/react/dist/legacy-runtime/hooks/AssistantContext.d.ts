import { AssistantRuntime } from "../runtime/AssistantRuntime.js";
/**
 * @deprecated Use `useAui()` instead. See migration guide: https://assistant-ui.com/docs/migrations/v0-12
 *
 * Hook to access the AssistantRuntime from the current context.
 *
 * The AssistantRuntime provides access to the top-level assistant state and actions,
 * including thread management, tool registration, and configuration.
 *
 * @param options Configuration options
 * @param options.optional Whether the hook should return null if no context is found
 * @returns The AssistantRuntime instance, or null if optional is true and no context exists
 *
 * @example
 * ```tsx
 * // Before:
 * function MyComponent() {
 *   const runtime = useAssistantRuntime();
 *   const handleNewThread = () => {
 *     runtime.switchToNewThread();
 *   };
 *   return <button onClick={handleNewThread}>New Thread</button>;
 * }
 *
 * // After:
 * function MyComponent() {
 *   const aui = useAui();
 *   const handleNewThread = () => {
 *     aui.threads().switchToNewThread();
 *   };
 *   return <button onClick={handleNewThread}>New Thread</button>;
 * }
 * ```
 */
export declare function useAssistantRuntime(options?: {
    optional?: false | undefined;
}): AssistantRuntime;
export declare function useAssistantRuntime(options?: {
    optional?: boolean | undefined;
}): AssistantRuntime | null;
/**
 * @deprecated Use `useAuiState((s) => s.threads)` instead. See migration guide: https://assistant-ui.com/docs/migrations/v0-12
 */
export declare const useThreadList: {
    (): import("@assistant-ui/core").ThreadListState;
    <TSelected>(selector: (state: import("@assistant-ui/core").ThreadListState) => TSelected): TSelected;
    <TSelected>(selector: ((state: import("@assistant-ui/core").ThreadListState) => TSelected) | undefined): import("@assistant-ui/core").ThreadListState | TSelected;
    (options: {
        optional?: false | undefined;
    }): import("@assistant-ui/core").ThreadListState;
    (options: {
        optional?: boolean | undefined;
    }): import("@assistant-ui/core").ThreadListState | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: import("@assistant-ui/core").ThreadListState) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: import("@assistant-ui/core").ThreadListState) => TSelected) | undefined;
    }): import("@assistant-ui/core").ThreadListState | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: import("@assistant-ui/core").ThreadListState) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: import("@assistant-ui/core").ThreadListState) => TSelected) | undefined;
    }): import("@assistant-ui/core").ThreadListState | TSelected | null;
};
//# sourceMappingURL=AssistantContext.d.ts.map