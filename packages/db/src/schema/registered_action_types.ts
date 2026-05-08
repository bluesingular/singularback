import { pgTable, uuid, text, boolean, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const registeredActionTypes = pgTable(
  "registered_action_types",
  {
    id:                uuid("id").primaryKey().defaultRandom(),
    companyId:         uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    slug:              text("slug").notNull(),
    name:              text("name").notNull(),
    description:       text("description"),
    inputSchema:       jsonb("input_schema").notNull().default({}),
    outputSchema:      jsonb("output_schema").notNull().default({}),
    webhookUrl:        text("webhook_url").notNull(),
    webhookSecret:     text("webhook_secret").notNull(),
    isActive:          boolean("is_active").notNull().default(true),
    createdByUserId:   text("created_by_user_id"),
    createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companySlugIdx: uniqueIndex("registered_action_types_company_slug_idx").on(t.companyId, t.slug),
    companyIdx:     index("registered_action_types_company_idx").on(t.companyId),
  }),
);
