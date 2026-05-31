/**
 * packages/db/src/schema/pending_jobs.ts
 *
 * P5: Transactional outbox for BullMQ jobs.
 * Written inside PostgreSQL transactions; outbox worker enqueues in BullMQ + marks sent.
 */

import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const pendingJobs = pgTable(
  "pending_jobs",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    queue:     varchar("queue", { length: 50 }).notNull(),
    payload:   jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt:    timestamp("sent_at", { withTimezone: true }),
  },
  (t) => ({
    unsentIdx: index("pending_jobs_unsent_idx").on(t.createdAt),
  }),
);
