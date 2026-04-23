#!/usr/bin/env node
declare const VALID_TEMPLATES: readonly ["default", "connector", "workspace"];
type PluginTemplate = (typeof VALID_TEMPLATES)[number];
export interface ScaffoldPluginOptions {
    pluginName: string;
    outputDir: string;
    template?: PluginTemplate;
    displayName?: string;
    description?: string;
    author?: string;
    category?: "connector" | "workspace" | "automation" | "ui";
    sdkPath?: string;
}
/** Validate npm-style plugin package names (scoped or unscoped). */
export declare function isValidPluginName(name: string): boolean;
/**
 * Generate a complete Paperclip plugin starter project.
 *
 * Output includes manifest/worker/UI entries, SDK harness tests, bundler presets,
 * and a local dev server script for hot-reload workflow.
 */
export declare function scaffoldPluginProject(options: ScaffoldPluginOptions): string;
export {};
//# sourceMappingURL=index.d.ts.map