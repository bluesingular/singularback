import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const publicApiKeys = pgTable(
  "public_api_keys",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    companyId:        uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name:             text("name").notNull(),
    keyHash:          text("key_hash").notNull(),
    scope:            text("scope").notNull().default("read_write"),
    rateLimitPerHour: integer("rate_limit_per_hour").notNull().default(1000),
    lastUsedAt:       timestamp("last_used_at",       { withTimezone: true }),
    revokedAt:        timestamp("revoked_at",         { withTimezone: true }),
    createdByUserId:  text("created_by_user_id"),
    createdAt:        timestamp("created_at",         { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    hashIdx:    uniqueIndex("public_api_keys_hash_idx").on(t.keyHash),
    companyIdx: index("public_api_keys_company_idx").on(t.companyId),
  }),
);

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    companyId:        uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    url:              text("url").notNull(),
    events:           jsonb("events").notNull().default([]),
    signingSecret:    text("signing_secret").notNull(),
    active:           boolean("active").notNull().default(true),
    createdByUserId:  text("created_by_user_id"),
    createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index("webhook_subscriptions_company_idx").on(t.companyId),
  }),
);
