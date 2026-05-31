/**
 * packages/db/src/schema/client_contexts.ts
 * §35 Client Context Architecture — sub-tenant isolation for delivery partners.
 */

import { pgTable, uuid, varchar, jsonb, boolean, decimal, text, timestamp, index, unique } from "drizzle-orm/pg-core";

export const clientContexts = pgTable(
  "client_contexts",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    name:      varchar("name", { length: 200 }).notNull(),
    slug:      varchar("slug", { length: 100 }).notNull(),
    clientDna: jsonb("client_dna").notNull().default({}),
    status:    varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index("client_contexts_company_idx").on(t.companyId, t.status),
    uniqueSlug: unique().on(t.companyId, t.slug),
  }),
);

export const clientSkillOverlays = pgTable(
  "client_skill_overlays",
  {
    id:                         uuid("id").primaryKey().defaultRandom(),
    companyId:                  uuid("company_id").notNull(),
    clientContextId:            uuid("client_context_id").notNull(),
    skillId:                    uuid("skill_id").notNull(),
    additionalSoulInstructions: text("additional_soul_instructions"),
    qualityThresholdAdjustment: decimal("quality_threshold_adjustment", { precision: 3, scale: 2 }),
    preferredToneOverride:      varchar("preferred_tone_override", { length: 30 }),
    sectorVocabulary:           text("sector_vocabulary").array().notNull().default([]),
    createdAt:                  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:                  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ctxIdx:     index("client_skill_overlays_ctx_idx").on(t.companyId, t.clientContextId),
    uniqueSkill: unique().on(t.clientContextId, t.skillId),
  }),
);
