import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

// ── pgvector custom column type ───────────────────────────────────────────────

/**
 * vector(dims) — pgvector column.
 * Stored as `[f1,f2,...,fn]` text in the driver; parsed back to number[].
 * Requires: CREATE EXTENSION IF NOT EXISTS vector; in migration.
 */
const vectorColumn = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1024)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // pgvector returns "[f1,f2,...]"
    return value
      .slice(1, -1)
      .split(",")
      .map(Number);
  },
});

// ── Table ─────────────────────────────────────────────────────────────────────

export const memoryEntries = pgTable(
  "memory_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id),
    title: text("title").notNull(),
    content: text("content").notNull(),
    // 1 = low, 3 = medium, 5 = high — used in weighted memory retrieval ranking
    importance: integer("importance").notNull().default(3),
    // M8: 1024-dim Mistral Embed vector for cosine similarity search
    embedding: vectorColumn("embedding"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyIdx: index("memory_entries_company_idx").on(table.companyId),
    agentIdx: index("memory_entries_agent_idx").on(table.agentId),
    // ivfflat index for approximate nearest-neighbour search (created in migration)
  }),
);
