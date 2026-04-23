/**
 * packages/db/src/schema/intelligence.ts
 *
 * Morning intelligence cards — M11.
 *
 * intelligence_cards — max 3 per company per day, urgency-ranked.
 *   insightKey — unique identifier for cooldown tracking (format: "{type}:{entityId}")
 *   14-day cooldown enforced per insightKey to prevent spam.
 *   Cards expire (auto-dismiss) after 7 days if unread.
 *
 * activation_moments — tracks which activation sequence triggers have fired.
 *   Used by the activation sequence (5 moments per pack, Days 0–7).
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

// ── intelligence_cards ────────────────────────────────────────────────────────

export const intelligenceCards = pgTable(
  "intelligence_cards",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // anomaly | trust | relationship | goal
    cardType: text("card_type").notNull(),
    title:    text("title").notNull(),
    body:     text("body").notNull(),

    // 1 (lowest) – 5 (highest) — cards ranked by this before taking top 3
    urgency: integer("urgency").notNull().default(3),

    // Deep link to the relevant section in the CEO Console
    actionUrl: text("action_url"),

    // unread | read | dismissed
    status: text("status").notNull().default("unread"),

    // Stable key for cooldown tracking: e.g. "trust:agent-1:qualification-cv"
    insightKey: text("insight_key").notNull(),

    // Auto-dismiss after 7 days if unread
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    companyIdx:    index("intelligence_cards_company_idx").on(t.companyId),
    statusIdx:     index("intelligence_cards_status_idx").on(t.status),
    insightKeyIdx: index("intelligence_cards_insight_key_idx").on(
      t.companyId,
      t.insightKey,
    ),
  }),
);

// ── activation_moments ────────────────────────────────────────────────────────

export const activationMoments = pgTable(
  "activation_moments",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Pack slug, e.g. "p1-recruitment"
    packSlug: text("pack_slug").notNull(),

    // Trigger identifier from activationSequence, e.g. "day_0_seed"
    triggerKey: text("trigger_key").notNull(),

    // Whether the notification/action was successfully delivered
    fired:   boolean("fired").notNull().default(false),
    firedAt: timestamp("fired_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    companyPackIdx: index("activation_moments_company_pack_idx").on(
      t.companyId,
      t.packSlug,
    ),
    // Each trigger fires at most once per company+pack
    uniqueTrigger: uniqueIndex("activation_moments_unique_trigger").on(
      t.companyId,
      t.packSlug,
      t.triggerKey,
    ),
  }),
);
