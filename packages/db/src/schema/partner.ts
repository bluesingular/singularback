/**
 * packages/db/src/schema/partner.ts
 * §34 Partner Programme — referral fees and white-label config.
 */

import { pgTable, uuid, varchar, boolean, decimal, text, timestamp } from "drizzle-orm/pg-core";

export const partnerReferralFees = pgTable("partner_referral_fees", {
  id:         uuid("id").primaryKey().defaultRandom(),
  partnerId:  text("partner_id").notNull(),
  companyId:  uuid("company_id").notNull(),
  amountEur:  decimal("amount_eur", { precision: 8, scale: 2 }).notNull(),
  paidAt:     timestamp("paid_at", { withTimezone: true }),
  paymentRef: varchar("payment_ref", { length: 100 }),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const partnerWhiteLabelConfig = pgTable("partner_white_label_config", {
  id:             uuid("id").primaryKey().defaultRandom(),
  partnerId:      text("partner_id").notNull(),
  brandName:      varchar("brand_name", { length: 100 }).notNull(),
  logoUrl:        varchar("logo_url", { length: 500 }),
  primaryColour:  varchar("primary_colour", { length: 7 }),
  supportEmail:   varchar("support_email", { length: 200 }),
  customDomain:   varchar("custom_domain", { length: 200 }),
  showPoweredBy:  boolean("show_powered_by").notNull().default(true),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
