/**
 * packages/db/src/schema/contacts.ts
 *
 * Contact entity tables — M8 foundation.
 *
 * contacts          — the person (candidate, client, partner)
 * contact_events    — timeline of interactions (email, meeting, interview…)
 * contact_notes     — agent-written notes about the contact
 *
 * Contact profiles are injected into Layer 4 of assembleContext() when a
 * contact name is detected in the task text (M8 contact injection trigger).
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    // Their employer / organisation (e.g. "Acme Consulting")
    organisation: text("organisation"),
    role: text("role"),
    // Free-form notes (human-entered)
    notes: text("notes"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    companyIdx: index("contacts_company_idx").on(t.companyId),
    // Case-insensitive name search — used by contact injection trigger
    nameIdx: index("contacts_name_idx").on(t.fullName),
  }),
);

export const contactEvents = pgTable(
  "contact_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    // email_sent, email_received, meeting, call, interview, submission, offer, etc.
    eventType: text("event_type").notNull(),
    summary: text("summary").notNull(),
    agentId: uuid("agent_id").references(() => agents.id),
    // task that produced this event (nullable — may be human-entered)
    taskId: uuid("task_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    contactIdx: index("contact_events_contact_idx").on(t.contactId),
    companyIdx: index("contact_events_company_idx").on(t.companyId),
    occurredAtIdx: index("contact_events_occurred_at_idx").on(t.occurredAt),
  }),
);

export const contactNotes = pgTable(
  "contact_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    agentId: uuid("agent_id").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    contactIdx: index("contact_notes_contact_idx").on(t.contactId),
    companyIdx: index("contact_notes_company_idx").on(t.companyId),
  }),
);
