import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { agents } from "./agents.js";

export const clarificationRequests = pgTable(
  "clarification_requests",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    companyId:    uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    issueId:      uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    agentId:      uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    question:     text("question").notNull(),
    status:       text("status").notNull().default("pending"),
    answer:       text("answer"),
    answeredBy:   text("answered_by"),
    timeoutJobId: text("timeout_job_id"),
    askedAt:      timestamp("asked_at", { withTimezone: true }).notNull().defaultNow(),
    answeredAt:   timestamp("answered_at", { withTimezone: true }),
    timedOutAt:   timestamp("timed_out_at", { withTimezone: true }),
  },
  (table) => ({
    companyIdx: index("clarification_requests_company_idx").on(table.companyId),
    issueIdx:   index("clarification_requests_issue_idx").on(table.issueId),
  }),
);
