/**
 * packages/db/src/schema/notifications.ts
 *
 * Gap E — Notification system.
 *
 * notifications — one row per event, scoped to a company.
 *   user_id null  → shown to all members of the company.
 *   user_id set   → shown to that user only.
 *   Delivery channels: inapp (default), email, push (Gap H).
 *
 * notification_preferences — per-user opt-in/out per type+channel.
 *   Defaults: approval and trust → email+inapp; intelligence → inapp only.
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { authUsers } from "./auth.js";

// ── notification type ─────────────────────────────────────────────────────────
// approval_pending  — agent output waiting for human review
// trust_proposal    — autonomy upgrade ready to approve
// trust_downgrade   — agent supervision increased automatically
// intelligence      — morning intelligence card
// agent_error       — agent hit an unrecoverable error
// budget_alert      — monthly spend approaching or over limit

// ── notifications ─────────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // null → all company members; set → specific user
    userId: uuid("user_id").references(() => authUsers.id, { onDelete: "cascade" }),

    // approval_pending | trust_proposal | trust_downgrade | intelligence | agent_error | budget_alert
    type: text("type").notNull(),

    title: text("title").notNull(),
    body:  text("body").notNull(),

    // Deep link into the app (e.g. /confiance, /taches/uuid, /console)
    actionUrl: text("action_url"),

    // unread | read | dismissed
    status: text("status").notNull().default("unread"),

    // Extra context for rendering (agentName, taskId, proposalId, etc.)
    metadata: jsonb("metadata"),

    // Channels delivered to (comma-separated: "inapp,email")
    channelsDelivered: text("channels_delivered").notNull().default("inapp"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Auto-expire after 30 days if unread
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    companyIdx:  index("notifications_company_idx").on(t.companyId),
    userIdx:     index("notifications_user_idx").on(t.userId),
    statusIdx:   index("notifications_status_idx").on(t.companyId, t.status),
    createdIdx:  index("notifications_created_idx").on(t.companyId, t.createdAt),
  }),
);

// ── notification_preferences ──────────────────────────────────────────────────

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),

    // approval_pending
    approvalInapp: boolean("approval_inapp").notNull().default(true),
    approvalEmail: boolean("approval_email").notNull().default(true),

    // trust_proposal + trust_downgrade
    trustInapp: boolean("trust_inapp").notNull().default(true),
    trustEmail: boolean("trust_email").notNull().default(true),

    // intelligence cards
    intelligenceInapp: boolean("intelligence_inapp").notNull().default(true),
    intelligenceEmail: boolean("intelligence_email").notNull().default(false),

    // agent_error
    errorInapp: boolean("error_inapp").notNull().default(true),
    errorEmail: boolean("error_email").notNull().default(true),

    // budget_alert
    budgetInapp: boolean("budget_inapp").notNull().default(true),
    budgetEmail: boolean("budget_email").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueUserCompany: uniqueIndex("notification_preferences_unique").on(
      t.companyId,
      t.userId,
    ),
  }),
);
