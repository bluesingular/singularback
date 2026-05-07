import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const gdprErasureLog = pgTable(
  "gdpr_erasure_log",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    companyId:      uuid("company_id").notNull(),
    subjectType:    text("subject_type").notNull(),   // 'contact' | 'user'
    subjectId:      uuid("subject_id").notNull(),
    subjectLabel:   text("subject_label"),            // name/email at erasure time
    requestedBy:    uuid("requested_by").notNull(),
    recordsDeleted: integer("records_deleted").notNull().default(0),
    retainedNote:   text("retained_note"),
    erasedAt:       timestamp("erased_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("gdpr_erasure_log_company_idx").on(t.companyId),
    index("gdpr_erasure_log_subject_idx").on(t.subjectId),
  ],
);
