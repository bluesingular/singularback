/**
 * packages/db/src/schema/skill_improvement.ts
 *
 * Skill versioning + evaluation framework — M10.
 *
 * skill_versions  — prompt version history per skill type.
 *                   Statuses: draft → pending_approval | active | blocked | deprecated
 * golden_datasets — curated evaluation examples (20 per skill in Pack P1).
 *                   Benchmarks run new versions against these before any activation.
 */
import { pgTable, uuid, text, integer, numeric, timestamp, jsonb, index, } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
// ── skill_versions ────────────────────────────────────────────────────────────
export const skillVersions = pgTable("skill_versions", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    // Skill type slug, e.g. "qualification-cv"
    skillType: text("skill_type").notNull(),
    // Semantic version string, e.g. "1.0.0", "1.1.0"
    version: text("version").notNull(),
    // Full SKILL.md body (prompt + instructions)
    promptBody: text("prompt_body").notNull(),
    // Parsed frontmatter as JSON (tier, gdprRequired, outputSchema, etc.)
    frontmatter: jsonb("frontmatter").notNull(),
    // draft | pending_approval | active | blocked | deprecated
    status: text("status").notNull().default("draft"),
    // Benchmark score from golden dataset evaluation (null = not yet benchmarked)
    benchmarkScore: numeric("benchmark_score", { precision: 4, scale: 2 }),
    benchmarkItemCount: integer("benchmark_item_count"),
    // The version this was forked/improved from (null = first version)
    parentVersionId: uuid("parent_version_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    // low_trust | damage_control | manual
    triggerReason: text("trigger_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (t) => ({
    companySkillIdx: index("skill_versions_company_skill_idx").on(t.companyId, t.skillType),
    statusIdx: index("skill_versions_status_idx").on(t.status),
}));
// ── golden_datasets ───────────────────────────────────────────────────────────
export const goldenDatasets = pgTable("golden_datasets", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    skillType: text("skill_type").notNull(),
    // Task input given to the agent (matches skill's expected input shape)
    input: jsonb("input").notNull(),
    // Exemplary output (human-curated or from highest-rated past tasks)
    expectedOutput: jsonb("expected_output").notNull(),
    // Human quality rating assigned to this example (1–5)
    qualityScore: integer("quality_score"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (t) => ({
    companySkillIdx: index("golden_datasets_company_skill_idx").on(t.companyId, t.skillType),
}));
//# sourceMappingURL=skill_improvement.js.map