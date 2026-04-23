import type { PluginLauncherRegistration } from "@paperclipai/plugin-sdk";
export declare const PLUGIN_ID = "paperclip-kitchen-sink-example";
export declare const PLUGIN_VERSION = "0.1.0";
export declare const PAGE_ROUTE = "kitchensink";
export declare const SLOT_IDS: {
    readonly page: "kitchen-sink-page";
    readonly settingsPage: "kitchen-sink-settings-page";
    readonly dashboardWidget: "kitchen-sink-dashboard-widget";
    readonly sidebar: "kitchen-sink-sidebar-link";
    readonly sidebarPanel: "kitchen-sink-sidebar-panel";
    readonly projectSidebarItem: "kitchen-sink-project-link";
    readonly projectTab: "kitchen-sink-project-tab";
    readonly issueTab: "kitchen-sink-issue-tab";
    readonly taskDetailView: "kitchen-sink-task-detail";
    readonly toolbarButton: "kitchen-sink-toolbar-action";
    readonly contextMenuItem: "kitchen-sink-context-action";
    readonly commentAnnotation: "kitchen-sink-comment-annotation";
    readonly commentContextMenuItem: "kitchen-sink-comment-action";
};
export declare const EXPORT_NAMES: {
    readonly page: "KitchenSinkPage";
    readonly settingsPage: "KitchenSinkSettingsPage";
    readonly dashboardWidget: "KitchenSinkDashboardWidget";
    readonly sidebar: "KitchenSinkSidebarLink";
    readonly sidebarPanel: "KitchenSinkSidebarPanel";
    readonly projectSidebarItem: "KitchenSinkProjectSidebarItem";
    readonly projectTab: "KitchenSinkProjectTab";
    readonly issueTab: "KitchenSinkIssueTab";
    readonly taskDetailView: "KitchenSinkTaskDetailView";
    readonly toolbarButton: "KitchenSinkToolbarButton";
    readonly contextMenuItem: "KitchenSinkContextMenuItem";
    readonly commentAnnotation: "KitchenSinkCommentAnnotation";
    readonly commentContextMenuItem: "KitchenSinkCommentContextMenuItem";
    readonly launcherModal: "KitchenSinkLauncherModal";
};
export declare const JOB_KEYS: {
    readonly heartbeat: "demo-heartbeat";
};
export declare const WEBHOOK_KEYS: {
    readonly demo: "demo-ingest";
};
export declare const TOOL_NAMES: {
    readonly echo: "echo";
    readonly companySummary: "company-summary";
    readonly createIssue: "create-issue";
};
export declare const STREAM_CHANNELS: {
    readonly progress: "progress";
    readonly agentChat: "agent-chat";
};
export declare const SAFE_COMMANDS: readonly [{
    readonly key: "pwd";
    readonly label: "Print workspace path";
    readonly command: "pwd";
    readonly args: string[];
    readonly description: "Prints the current workspace directory.";
}, {
    readonly key: "ls";
    readonly label: "List workspace files";
    readonly command: "ls";
    readonly args: string[];
    readonly description: "Lists files in the selected workspace.";
}, {
    readonly key: "git-status";
    readonly label: "Git status";
    readonly command: "git";
    readonly args: string[];
    readonly description: "Shows git status for the selected workspace.";
}];
export type SafeCommandKey = (typeof SAFE_COMMANDS)[number]["key"];
export declare const DEFAULT_CONFIG: {
    readonly showSidebarEntry: true;
    readonly showSidebarPanel: true;
    readonly showProjectSidebarItem: true;
    readonly showCommentAnnotation: true;
    readonly showCommentContextMenuItem: true;
    readonly enableWorkspaceDemos: true;
    readonly enableProcessDemos: false;
    readonly secretRefExample: "";
    readonly httpDemoUrl: "https://httpbin.org/anything";
    readonly allowedCommands: ("pwd" | "ls" | "git-status")[];
    readonly workspaceScratchFile: ".paperclip-kitchen-sink-demo.txt";
};
export declare const RUNTIME_LAUNCHER: PluginLauncherRegistration;
//# sourceMappingURL=constants.d.ts.map