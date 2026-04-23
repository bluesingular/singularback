import { pgTable, uuid, text, integer, bigint, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
export const companies = pgTable("companies", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Singular.blue: URL-safe unique identifier, auto-generated from name on creation
    slug: text("slug").notNull().unique(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    pauseReason: text("pause_reason"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    issuePrefix: text("issue_prefix").notNull().default("PAP"),
    issueCounter: integer("issue_counter").notNull().default(0),
    budgetMonthlyCents: integer("budget_monthly_cents").notNull().default(0),
    spentMonthlyCents: integer("spent_monthly_cents").notNull().default(0),
    requireBoardApprovalForNewAgents: boolean("require_board_approval_for_new_agents")
        .notNull()
        .default(true),
    feedbackDataSharingEnabled: boolean("feedback_data_sharing_enabled")
        .notNull()
        .default(false),
    feedbackDataSharingConsentAt: timestamp("feedback_data_sharing_consent_at", { withTimezone: true }),
    feedbackDataSharingConsentByUserId: text("feedback_data_sharing_consent_by_user_id"),
    feedbackDataSharingTermsVersion: text("feedback_data_sharing_terms_version"),
    brandColor: text("brand_color"),
    // Singular.blue: subscription plan
    plan: text("plan").notNull().default("growth"),
    // Singular.blue: monthly usage counters (reset on billing_period_start)
    tasksUsedMonth: integer("tasks_used_month").notNull().default(0),
    tasksLimitMonth: integer("tasks_limit_month").notNull().default(2000),
    tokensUsedMonth: bigint("tokens_used_month", { mode: "number" }).notNull().default(0),
    tokensLimitMonth: bigint("tokens_limit_month", { mode: "number" }).notNull().default(20_000_000),
    billingPeriodStart: timestamp("billing_period_start", { withTimezone: true }).notNull().defaultNow(),
    // Singular.blue: Stripe identifiers
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubId: text("stripe_sub_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    issuePrefixUniqueIdx: uniqueIndex("companies_issue_prefix_idx").on(table.issuePrefix),
}));
//# sourceMappingURL=companies.js.map