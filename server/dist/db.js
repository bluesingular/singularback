/**
 * server/src/db.ts
 *
 * Lazy database initialization for workers.
 * Workers use this module to get a db connection without creating
 * circular dependencies with index.ts.
 */
import { createDb } from "@paperclipai/db";
let cachedDb = null;
function initDb() {
    if (!cachedDb) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error("DATABASE_URL not set. Workers require an explicit database connection string.");
        }
        cachedDb = createDb(connectionString);
    }
    return cachedDb;
}
export const db = initDb();
//# sourceMappingURL=db.js.map