import { type ReactElement } from "react";
import { type TextareaAutosizeProps } from "react-textarea-autosize";
export declare namespace ComposerPrimitiveInput {
    export type Element = HTMLTextAreaElement;
    type BaseProps = {
        /**
         * Whether to render as a child component using Slot.
         * When true, the component will merge its props with its child.
         */
        asChild?: boolean | undefined;
        /**
         * A React element to use as the input container, with props merged in.
         */
        render?: ReactElement | undefined;
        /**
         * Whether to cancel message composition when Escape is pressed.
         * @default true
         */
        cancelOnEscape?: boolean | undefined;
        /**
         * Whether to automatically focus the input when a new run starts.
         * @default true
         */
        unstable_focusOnRunStart?: boolean | undefined;
        /**
         * Whether to automatically focus the input when scrolling to bottom.
         * @default true
         */
        unstable_focusOnScrollToBottom?: boolean | undefined;
        /**
         * Whether to automatically focus the input when switching threads.
         * @default true
         */
        unstable_focusOnThreadSwitched?: boolean | undefined;
        /**
         * Whether to automatically add pasted files as attachments.
         * @default true
         */
        addAttachmentOnPaste?: boolean | undefined;
    };
    type SubmitModeProps = {
        /**
         * Controls how the Enter key submits messages.
         * - "enter": Plain Enter submits (Shift+Enter for newline)
         * - "ctrlEnter": Ctrl/Cmd+Enter submits (plain Enter for newline)
         * - "none": Keyboard submission disabled
         * @default "enter"
         */
        submitMode?: "enter" | "ctrlEnter" | "none" | undefined;
        /**
         * @deprecated Use `submitMode` instead
         * @ignore
         */
        submitOnEnter?: never;
    } | {
        submitMode?: never;
        /**
         * Whether to submit the message when Enter is pressed (without Shift).
         * @default true
         * @deprecated Use `submitMode` instead. Will be removed in a future version.
         */
        submitOnEnter?: boolean | undefined;
    };
    export type Props = TextareaAutosizeProps & BaseProps & SubmitModeProps;
    export {};
}
/**
 * A text input component for composing messages.
 *
 * This component provides a rich text input experience with automatic resizing,
 * keyboard shortcuts, file paste support, and intelligent focus management.
 * It integrates with the composer context to manage message state and submission.
 *
 * @example
 * ```tsx
 * // Ctrl/Cmd+Enter to submit (plain Enter inserts newline)
 * <ComposerPrimitive.Input
 *   placeholder="Type your message..."
 *   submitMode="ctrlEnter"
 * />
 *
 * // Old API (deprecated, still supported)
 * <ComposerPrimitive.Input
 *   placeholder="Type your message..."
 *   submitOnEnter={true}
 * />
 * ```
 */
export declare const ComposerPrimitiveInput: import("react").ForwardRefExoticComponent<ComposerPrimitiveInput.Props & import("react").RefAttributes<HTMLTextAreaElement>>;
//# sourceMappingURL=ComposerInput.d.ts.map