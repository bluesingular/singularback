import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const mcpApiKeys = pgTable(
  "mcp_api_keys",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    companyId:  uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name:       text("name").notNull(),
    keyHash:    text("key_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt:  timestamp("revoked_at",   { withTimezone: true }),
    createdAt:  timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    hashIdx:    uniqueIndex("mcp_api_keys_hash_idx").on(t.keyHash),
    companyIdx: index("mcp_api_keys_company_idx").on(t.companyId),
  }),
);
