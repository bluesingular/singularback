import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const pushSubscriptions = pgTable("push_subscriptions", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  userId:    text("user_id").notNull(),
  endpoint:  text("endpoint").notNull().unique(),
  p256dh:    text("p256dh").notNull(),
  auth:      text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
