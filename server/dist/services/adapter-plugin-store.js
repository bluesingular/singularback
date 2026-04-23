/**
 * JSON-file-backed store for external adapter registrations.
 *
 * Stores metadata about externally installed adapter packages at
 * ~/.paperclip/adapter-plugins.json. This is the source of truth for which
 * external adapters should be loaded at startup.
 *
 * Both the plugin store and the settings store are cached in memory after
 * the first read. Writes invalidate the cache so the next read picks up
 * the new state without a redundant disk round-trip.
 *
 * @module server/services/adapter-plugin-store
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const PAPERCLIP_DIR = path.join(os.homedir(), ".paperclip");
const ADAPTER_PLUGINS_DIR = path.join(PAPERCLIP_DIR, "adapter-plugins");
const ADAPTER_PLUGINS_STORE_PATH = path.join(PAPERCLIP_DIR, "adapter-plugins.json");
const ADAPTER_SETTINGS_PATH = path.join(PAPERCLIP_DIR, "adapter-settings.json");
// ---------------------------------------------------------------------------
// In-memory caches (invalidated on write)
// ---------------------------------------------------------------------------
let storeCache = null;
let settingsCache = null;
// ---------------------------------------------------------------------------
// Store functions
// ---------------------------------------------------------------------------
function ensureDirs() {
    fs.mkdirSync(ADAPTER_PLUGINS_DIR, { recursive: true });
    const pkgJsonPath = path.join(ADAPTER_PLUGINS_DIR, "package.json");
    if (!fs.existsSync(pkgJsonPath)) {
        fs.writeFileSync(pkgJsonPath, JSON.stringify({
            name: "paperclip-adapter-plugins",
            version: "0.0.0",
            private: true,
            description: "Managed directory for Paperclip external adapter plugins. Do not edit manually.",
        }, null, 2) + "\n");
    }
}
function readStore() {
    if (storeCache)
        return storeCache;
    try {
        const raw = fs.readFileSync(ADAPTER_PLUGINS_STORE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        storeCache = Array.isArray(parsed) ? parsed : [];
    }
    catch {
        storeCache = [];
    }
    return storeCache;
}
function writeStore(records) {
    ensureDirs();
    fs.writeFileSync(ADAPTER_PLUGINS_STORE_PATH, JSON.stringify(records, null, 2), "utf-8");
    storeCache = records;
}
function readSettings() {
    if (settingsCache)
        return settingsCache;
    try {
        const raw = fs.readFileSync(ADAPTER_SETTINGS_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        settingsCache = parsed && Array.isArray(parsed.disabledTypes)
            ? parsed
            : { disabledTypes: [] };
    }
    catch {
        settingsCache = { disabledTypes: [] };
    }
    return settingsCache;
}
function writeSettings(settings) {
    ensureDirs();
    fs.writeFileSync(ADAPTER_SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
    settingsCache = settings;
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function listAdapterPlugins() {
    return readStore();
}
export function addAdapterPlugin(record) {
    const store = [...readStore()];
    const idx = store.findIndex((r) => r.type === record.type);
    if (idx >= 0) {
        store[idx] = record;
    }
    else {
        store.push(record);
    }
    writeStore(store);
}
export function removeAdapterPlugin(type) {
    const store = [...readStore()];
    const idx = store.findIndex((r) => r.type === type);
    if (idx < 0)
        return false;
    store.splice(idx, 1);
    writeStore(store);
    return true;
}
export function getAdapterPluginByType(type) {
    return readStore().find((r) => r.type === type);
}
export function getAdapterPluginsDir() {
    ensureDirs();
    return ADAPTER_PLUGINS_DIR;
}
// ---------------------------------------------------------------------------
// Adapter enable/disable (settings)
// ---------------------------------------------------------------------------
export function getDisabledAdapterTypes() {
    return readSettings().disabledTypes;
}
export function isAdapterDisabled(type) {
    return readSettings().disabledTypes.includes(type);
}
export function setAdapterDisabled(type, disabled) {
    const settings = { ...readSettings(), disabledTypes: [...readSettings().disabledTypes] };
    const idx = settings.disabledTypes.indexOf(type);
    if (disabled && idx < 0) {
        settings.disabledTypes.push(type);
        writeSettings(settings);
        return true;
    }
    if (!disabled && idx >= 0) {
        settings.disabledTypes.splice(idx, 1);
        writeSettings(settings);
        return true;
    }
    return false;
}
//# sourceMappingURL=adapter-plugin-store.js.map