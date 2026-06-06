import { pgTable, uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { documents } from "./documents.js";
import { agents } from "./agents.js";

export const documentAnnotations = pgTable(
  "document_annotations",
  {
    id:                 uuid("id").primaryKey().defaultRandom(),
    documentId:         uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    companyId:          uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    revisionId:         uuid("revision_id"),
    anchorStart:        integer("anchor_start").notNull(),
    anchorEnd:          integer("anchor_end").notNull(),
    selectedText:       text("selected_text").notNull(),
    parentId:           uuid("parent_id"),
    body:               text("body").notNull(),
    resolved:           boolean("resolved").notNull().default(false),
    createdByUserId:    text("created_by_user_id"),
    createdByAgentId:   uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentIdx: index("document_annotations_document_idx").on(table.documentId, table.createdAt),
    parentIdx:   index("document_annotations_parent_idx").on(table.parentId),
  }),
);
