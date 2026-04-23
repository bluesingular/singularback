import type { ServerAdapterModule } from "./types.js";
/**
 * Await this before validating adapter types to avoid race conditions
 * during server startup. External adapters are loaded asynchronously;
 * calling assertKnownAdapterType before this resolves will reject
 * valid external adapter types.
 */
export declare function waitForExternalAdapters(): Promise<void>;
export declare function registerServerAdapter(adapter: ServerAdapterModule): void;
export declare function unregisterServerAdapter(type: string): void;
export declare function requireServerAdapter(type: string): ServerAdapterModule;
export declare function getServerAdapter(type: string): ServerAdapterModule;
export declare function listAdapterModels(type: string): Promise<{
    id: string;
    label: string;
}[]>;
export declare function listServerAdapters(): ServerAdapterModule[];
/**
 * List adapters excluding those that are disabled in settings.
 * Used for menus and agent creation flows — disabled adapters remain
 * functional for existing agents but hidden from selection.
 */
export declare function listEnabledServerAdapters(): ServerAdapterModule[];
export declare function detectAdapterModel(type: string): Promise<{
    model: string;
    provider: string;
    source: string;
    candidates?: string[];
} | null>;
/**
 * Pause or resume an external override for a builtin adapter type.
 *
 * - `paused = true`  → subsequent calls to `getServerAdapter(type)` return
 *   the builtin fallback instead of the external adapter.  Already-running
 *   agent sessions are unaffected (they hold a reference to the module they
 *   started with).
 *
 * - `paused = false` → the external adapter is active again.
 *
 * Returns `true` if the state actually changed, `false` if the type is not
 * an override or was already in the requested state.
 */
export declare function setOverridePaused(type: string, paused: boolean): boolean;
/** Check whether the external override for a builtin type is currently paused. */
export declare function isOverridePaused(type: string): boolean;
/** Get the set of types whose overrides are currently paused. */
export declare function getPausedOverrides(): Set<string>;
export declare function findServerAdapter(type: string): ServerAdapterModule | null;
export declare function findActiveServerAdapter(type: string): ServerAdapterModule | null;
//# sourceMappingURL=registry.d.ts.map