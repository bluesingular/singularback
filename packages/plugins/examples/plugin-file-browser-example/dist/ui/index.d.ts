import type { PluginProjectSidebarItemProps, PluginDetailTabProps, PluginCommentAnnotationProps, PluginCommentContextMenuItemProps } from "@paperclipai/plugin-sdk/ui";
/**
 * Project sidebar item: link "Files" that opens the project detail with the Files plugin tab.
 */
export declare function FilesLink({ context }: PluginProjectSidebarItemProps): import("react/jsx-runtime").JSX.Element | null;
/**
 * Project detail tab: workspace selector, file tree, and CodeMirror editor.
 */
export declare function FilesTab({ context }: PluginDetailTabProps): import("react/jsx-runtime").JSX.Element;
export declare function CommentFileLinks({ context }: PluginCommentAnnotationProps): import("react/jsx-runtime").JSX.Element | null;
/**
 * Per-comment context menu item that appears in the comment "more" (⋮) menu.
 * Extracts file paths from the comment body and, if any are found, renders
 * a button to open the first file in the project Files tab.
 *
 * Respects the `commentAnnotationMode` instance config — hidden when mode
 * is `"annotation"` or `"none"`.
 */
export declare function CommentOpenFiles({ context }: PluginCommentContextMenuItemProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=index.d.ts.map