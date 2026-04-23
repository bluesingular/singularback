/**
 * packages/db/src/schema/trust.ts
 *
 * Trust calibration system — M9.
 *
 * trust_scores   — per-agent per-skill-type rolling score (updated after each task)
 * trust_proposals — autonomy upgrade proposals (Tier A always requires human approval)
 */
import { pgTable, uuid, text, integer, numeric, timestamp, jsonb, index, uniqueIndex, } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
// ── trust_scores ──────────────────────────────────────────────────────────────
export const trustScores = pgTable("trust_scores", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
        .notNull()
        .references(() => agents.id, { onDelete: "cascade" }),
    // Skill type slug, e.g. "qualification-cv"
    skillType: text("skill_type").notNull(),
    // Current computed trust score (0.00–5.00)
    score: numeric("score", { precision: 4, scale: 2 }).notNull().default("0"),
    // Current autonomy level: building | supervised | trusted | highlyTrusted
    autonomyLevel: text("autonomy_level").notNull().default("building"),
    // Consecutive task approvals rated 4+★ (reset on any < 4★)
    approvalStreak: integer("approval_streak").notNull().default(0),
    // Rolling 30-day metrics used in score calculation
    qualityRatingAvg: numeric("quality_rating_avg", { precision: 4, scale: 2 }),
    gatePassRate: numeric("gate_pass_rate", { precision: 4, scale: 2 }),
    schemaPassRate: numeric("schema_pass_rate", { precision: 4, scale: 2 }),
    // Tasks counted in the current window
    taskCountWindow: integer("task_count_window").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (t) => ({
    agentSkillUnique: uniqueIndex("trust_scores_agent_skill_unique").on(t.agentId, t.skillType),
    companyIdx: index("trust_scores_company_idx").on(t.companyId),
}));
// ── trust_proposals ───────────────────────────────────────────────────────────
export const trustProposals = pgTable("trust_proposals", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
        .notNull()
        .references(() => agents.id, { onDelete: "cascade" }),
    skillType: text("skill_type").notNull(),
    currentLevel: text("current_level").notNull(),
    proposedLevel: text("proposed_level").notNull(),
    // Score at time of proposal
    trustScore: numeric("trust_score", { precision: 4, scale: 2 }).notNull(),
    approvalStreak: integer("approval_streak").notNull(),
    // Evidence surfaced to the operator: { taskCount, avgRating, gatePassRate, schemaPassRate }
    evidence: jsonb("evidence").notNull(),
    // pending | approved | rejected
    status: text("status").notNull().default("pending"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (t) => ({
    companyIdx: index("trust_proposals_company_idx").on(t.companyId),
    agentIdx: index("trust_proposals_agent_idx").on(t.agentId),
    pendingIdx: index("trust_proposals_status_idx").on(t.status),
}));
//# sourceMappingURL=trust.js.map