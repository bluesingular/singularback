import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { authUsers } from "./auth.js";
export const companyDna = pgTable("company_dna", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
        .notNull()
        .unique()
        .references(() => companies.id, { onDelete: "cascade" }),
    description: text("description").notNull().default(""),
    customerProfile: text("customer_profile").notNull().default(""),
    tone: text("tone").notNull().default("professional"),
    brandRules: text("brand_rules").notNull().default(""),
    regulatoryContext: text("regulatory_context").notNull().default(""),
    forbiddenTopics: text("forbidden_topics").array().notNull().default([]),
    terminology: jsonb("terminology").$type().notNull().default({}),
    competitors: text("competitors").array().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").references(() => authUsers.id),
});
//# sourceMappingURL=company_dna.js.map