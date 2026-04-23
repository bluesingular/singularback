/**
 * server/src/packs/types.ts
 *
 * Pack manifest type definitions — M12.
 *
 * A pack is a self-contained bundle that installs a complete AI team for a
 * vertical (e.g. recruitment agencies). The installer reads pack.json and
 * runs a 7-step atomic transaction.
 */
// ── Errors ────────────────────────────────────────────────────────────────────
export class PackValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "PackValidationError";
    }
}
export class PackInstallError extends Error {
    step;
    cause;
    constructor(message, step, cause) {
        super(message);
        this.step = step;
        this.cause = cause;
        this.name = "PackInstallError";
    }
}
//# sourceMappingURL=types.js.map