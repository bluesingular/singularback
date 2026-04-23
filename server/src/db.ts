/**
 * server/src/db.ts
 *
 * Lazy database initialization for workers.
 * Workers use this module to get a db connection without creating
 * circular dependencies with index.ts.
 */

import { createDb } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";

let cachedDb: Db | null = null;

function initDb(): Db {
  if (!cachedDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL not set. Workers require an explicit database connection string.",
      );
    }
    cachedDb = createDb(connectionString);
  }
  return cachedDb;
}

export const db: Db = initDb();
