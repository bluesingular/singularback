/**
 * server/src/db.ts
 *
 * Lazy database initialization for workers.
 * Workers use this module to get a db connection without creating
 * circular dependencies with index.ts.
 */
import type { Db } from "@paperclipai/db";
export declare const db: Db;
//# sourceMappingURL=db.d.ts.map