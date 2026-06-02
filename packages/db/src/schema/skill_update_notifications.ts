import { pgTable, uuid, text, varchar, timestamp, unique, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { companySkills } from "./company_skills.js";

export const skillUpdateNotifications = pgTable(
  "skill_update_notifications",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    masterSkillId:  uuid("master_skill_id").notNull().references(() => companySkills.id, { onDelete: "cascade" }),
    tenantSkillId:  uuid("tenant_skill_id").notNull().references(() => companySkills.id, { onDelete: "cascade" }),
    companyId:      uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    newVersion:     varchar("new_version", { length: 20 }).notNull(),
    changelog:      text("changelog"),
    status:         varchar("status", { length: 20 }).notNull().default("pending"),
    mergeStrategy:  varchar("merge_strategy", { length: 20 }).notNull().default("take_master"),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt:      timestamp("decided_at", { withTimezone: true }),
  },
  (t) => ({
    uniqueTenantVersion: unique().on(t.tenantSkillId, t.newVersion),
    companyIdx:          index("skill_update_notifications_company_idx").on(t.companyId, t.status),
    masterIdx:           index("skill_update_notifications_master_idx").on(t.masterSkillId, t.status),
  }),
);
