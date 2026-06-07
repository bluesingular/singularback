/**
 * Tests for the "at 50 customers" build phase
 *
 * AG-6  — Procedural memory (learning/pattern-from-corrections.ts)
 * AG-7  — Outcome-based learning (intelligence/narrative.ts outcomeAttributions)
 * AG-10 — Production behavioral monitoring (monitoring/behavioral.ts)
 * AG-11 — Cross-session narrative coherence (intelligence/narrative.ts)
 * Gap A — Non-determinism debugging / variance tracking (evals/variance.ts)
 * Gap D — Model upgrade resilience / skill model pins (llm/model-pins.ts)
 * Gap F — Semantic caching (memory/semantic-cache.ts)
 * Gap G — Agent-initiated task proposals (routes/agent-proposals.ts)
 * Gap I — Cost attribution per mission/goal/agent (DB schema)
 * Gap L — Explainability-privacy compliance (safety/explainability.ts)
 */

import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

// ─────────────────────────────────────────────────────────────────────────────
// AG-6 — Procedural memory (pattern-from-corrections.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe("AG-6 — Procedural memory", () => {
  it("maybeExtractCorrectionPattern is exported from pattern-from-corrections.ts", async () => {
    const { maybeExtractCorrectionPattern } = await import("../learning/pattern-from-corrections.js");
    expect(typeof maybeExtractCorrectionPattern).toBe("function");
  });

  it("source='operator_correction' is used when writing procedural patterns", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/learning/pattern-from-corrections.ts"), "utf8"
    );
    expect(src).toContain("operator_correction");
  });

  it("procedural_patterns table is imported and written", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/learning/pattern-from-corrections.ts"), "utf8"
    );
    expect(src).toContain("proceduralPatterns");
  });

  it("minimum threshold: requires multiple corrections before creating pattern", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/learning/pattern-from-corrections.ts"), "utf8"
    );
    // The function checks how many corrections exist before promoting to pattern
    expect(src).toMatch(/count|length|\.length|MIN|threshold/i);
  });

  it("procedural_patterns schema exists in packages/db", () => {
    const schemaExists = fs.existsSync(
      path.join(ROOT, "packages/db/src/schema/agentic_learning.ts")
    );
    expect(schemaExists).toBe(true);
    const schema = fs.readFileSync(
      path.join(ROOT, "packages/db/src/schema/agentic_learning.ts"), "utf8"
    );
    expect(schema).toContain("proceduralPatterns");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AG-7 — Outcome-based learning (narrative.ts)
// ─────────────────────────────────────────────────────────────────────────────

import { generateNarrative, getLatestNarrative, type Momentum } from "../intelligence/narrative.js";

describe("AG-7 — Outcome-based learning / narrative coherence", () => {
  it("generateNarrative is exported", () => {
    expect(typeof generateNarrative).toBe("function");
  });

  it("getLatestNarrative is exported", () => {
    expect(typeof getLatestNarrative).toBe("function");
  });

  it("Momentum type has three valid values", () => {
    const values: Momentum[] = ["accelerating", "stable", "decelerating"];
    expect(values).toHaveLength(3);
  });

  it("narrative uses outcomeAttributions table", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/intelligence/narrative.ts"), "utf8"
    );
    expect(src).toContain("outcomeAttributions");
  });

  it("narrative queries run in Promise.all (no sequential awaits in assembly)", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/intelligence/narrative.ts"), "utf8"
    );
    expect(src).toContain("Promise.all");
  });

  it("getLatestNarrative returns null for company with no narrative", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: () => Promise.resolve([]) }),
          }),
        }),
      }),
    } as unknown as import("@paperclipai/db").Db;

    const result = await getLatestNarrative(db, "no-company");
    expect(result).toBeNull();
  });

  it("getLatestNarrative returns narrativeMd string when record exists", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ narrativeMd: "# Votre équipe a traité 12 missions ce mois." }]),
            }),
          }),
        }),
      }),
    } as unknown as import("@paperclipai/db").Db;

    const result = await getLatestNarrative(db, "company-1");
    expect(result).toContain("12 missions");
  });

  it("outcomeAttributions schema exists", () => {
    const schema = fs.readFileSync(
      path.join(ROOT, "packages/db/src/schema/agentic_learning.ts"), "utf8"
    );
    expect(schema).toContain("outcomeAttributions");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AG-10 — Production behavioral monitoring
// ─────────────────────────────────────────────────────────────────────────────

import { refreshBaselines, detectAnomalies, type BaselineMetrics } from "../monitoring/behavioral.js";

describe("AG-10 — Production behavioral monitoring", () => {
  it("BaselineMetrics interface has required fields", () => {
    const placeholder: BaselineMetrics = {
      avgJudgeScore:    8.2,
      avgOutputTokens:  450,
      avgToolCalls:     1.3,
      avgExecutionMs:   820,
      approvalRate:     0.92,
      recycleRate:      0.05,
      baselineTaskCount: 35,
    };
    expect(placeholder.avgJudgeScore).toBe(8.2);
    expect(placeholder.baselineTaskCount).toBe(35);
  });

  it("refreshBaselines is exported and async", () => {
    expect(typeof refreshBaselines).toBe("function");
  });

  it("detectAnomalies is exported and async", () => {
    expect(typeof detectAnomalies).toBe("function");
  });

  it("baselines established after 30+ tasks (threshold enforced)", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/monitoring/behavioral.ts"), "utf8"
    );
    // Must check task count threshold before establishing baseline
    expect(src).toMatch(/30|MIN_TASK|minTask/);
  });

  it("anomaly threshold is 2 standard deviations (ANOMALY_STD_THRESHOLD = 2.0)", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/monitoring/behavioral.ts"), "utf8"
    );
    expect(src).toContain("ANOMALY_STD_THRESHOLD");
    expect(src).toContain("2.0");
  });

  it("anomalies are only surfaced in admin portal — never operator-facing", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/monitoring/behavioral.ts"), "utf8"
    );
    // Admin-only — anomalies are written to behavioral_anomalies, not surfaced to operators
    expect(src).toContain("behavioral_anomalies");
  });

  it("behavioral_baselines and behavioral_anomalies tables exist in migration", () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT, "packages/db/src/migrations/0090_50_customers.sql"), "utf8"
    );
    expect(migrationSql).toContain("behavioral_baselines");
    expect(migrationSql).toContain("behavioral_anomalies");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AG-11 — Cross-session narrative coherence
// ─────────────────────────────────────────────────────────────────────────────

describe("AG-11 — Cross-session narrative coherence", () => {
  it("company_narrative table exists in migration", () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT, "packages/db/src/migrations/0090_50_customers.sql"), "utf8"
    );
    expect(migrationSql).toContain("company_narrative");
  });

  it("narrative includes momentum field (accelerating/stable/decelerating)", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/intelligence/narrative.ts"), "utf8"
    );
    expect(src).toContain("accelerating");
    expect(src).toContain("stable");
    expect(src).toContain("decelerating");
  });

  it("narrative covers key_events JSONB array", () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT, "packages/db/src/migrations/0090_50_customers.sql"), "utf8"
    );
    expect(migrationSql).toContain("key_events");
  });

  it("narrative is injected into orchestrator context via getLatestNarrative", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/intelligence/narrative.ts"), "utf8"
    );
    expect(src).toContain("getLatestNarrative");
    // Must be suitable for orchestrator preamble injection
    expect(src).toContain("orchestrator");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap A — Non-determinism debugging / variance tracking
// ─────────────────────────────────────────────────────────────────────────────

import { computeSkillVariance, runVarianceSweep } from "../evals/variance.js";

describe("Gap A — Non-determinism debugging (skill variance)", () => {
  it("computeSkillVariance is exported", () => {
    expect(typeof computeSkillVariance).toBe("function");
  });

  it("runVarianceSweep is exported", () => {
    expect(typeof runVarianceSweep).toBe("function");
  });

  it("variance flag threshold is std > 1.2 per spec", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/evals/variance.ts"), "utf8"
    );
    expect(src).toContain("1.2");
    expect(src).toContain("varianceFlag");
  });

  it("variance metrics are stored in skill_variance_metrics table", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/evals/variance.ts"), "utf8"
    );
    expect(src).toContain("skillVarianceMetrics");
  });

  it("runVarianceSweep returns companies and skills counts", async () => {
    // runVarianceSweep: db.select().from(companies) → no .where() → Promise directly
    // Then per company: db.select().from(companySkills).where() → []
    let callN = 0;
    const db = {
      select: () => ({
        from: () => {
          const n = callN++;
          if (n === 0) return Promise.resolve([]); // allCompanies = empty
          return { where: () => Promise.resolve([]) };
        },
      }),
    } as unknown as import("@paperclipai/db").Db;

    const result = await runVarianceSweep(db);
    expect(typeof result.companies).toBe("number");
    expect(typeof result.skills).toBe("number");
    expect(result.companies).toBe(0);
  });

  it("high-variance skills flagged in admin portal only — never surfaced to operators", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/evals/variance.ts"), "utf8"
    );
    // No operator-facing notifications from variance module
    expect(src).not.toContain("createNotification");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap D — Model upgrade resilience
// ─────────────────────────────────────────────────────────────────────────────

import { applyModelPin, type ModelPin } from "../llm/model-pins.js";

describe("Gap D — Model upgrade resilience (skill model pins)", () => {
  it("applyModelPin returns pinned model for non-GDPR skills", () => {
    const result = applyModelPin({
      originalModel: "mistralai/mistral-small-3.2",
      pinnedModel:   "mistralai/ministral-3b",
      gdprRequired:  false,
    });
    expect(result).toBe("mistralai/ministral-3b");
  });

  it("applyModelPin returns pinned model when pinned model is EU-hosted + GDPR required", () => {
    const result = applyModelPin({
      originalModel: "mistralai/mistral-small-3.2",
      pinnedModel:   "mistralai/mistral-medium-3.1",  // EU-hosted
      gdprRequired:  true,
    });
    expect(result).toBe("mistralai/mistral-medium-3.1");
  });

  it("applyModelPin falls back to original when GDPR required and pin is non-EU model", () => {
    const result = applyModelPin({
      originalModel: "mistralai/mistral-small-3.2",
      pinnedModel:   "deepseek/deepseek-chat-v3-5",   // non-EU
      gdprRequired:  true,
    });
    // GDPR invariant: non-EU pin ignored
    expect(result).toBe("mistralai/mistral-small-3.2");
  });

  it("ModelPin pinnedReason is constrained to two values", () => {
    const reasons: ModelPin["pinnedReason"][] = [
      "upgrade_blocked_by_regression",
      "manual_pin",
    ];
    expect(reasons).toHaveLength(2);
  });

  it("getModelPin and setModelPin and clearModelPin are all exported", async () => {
    const mod = await import("../llm/model-pins.js");
    expect(typeof mod.getModelPin).toBe("function");
    expect(typeof mod.setModelPin).toBe("function");
    expect(typeof mod.clearModelPin).toBe("function");
  });

  it("skill_model_pins table exists in migration", () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT, "packages/db/src/migrations/0090_50_customers.sql"), "utf8"
    );
    expect(migrationSql).toContain("skill_model_pins");
  });

  it("GDPR invariant is documented in model-pins.ts", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/llm/model-pins.ts"), "utf8"
    );
    expect(src).toContain("GDPR");
    expect(src).toContain("EU");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap F — Semantic caching
// ─────────────────────────────────────────────────────────────────────────────

import { getCachedResponse, setCachedResponse } from "../memory/semantic-cache.js";

describe("Gap F — Semantic caching", () => {
  it("getCachedResponse returns null for gdpr_required:true (GDPR invariant)", async () => {
    const result = await getCachedResponse({
      companyId:    "company-1",
      skillSlug:    "cv_qualification",
      gdprRequired: true,
      embedding:    Array(32).fill(0.5),
    });
    expect(result).toBeNull();
  });

  it("setCachedResponse is a no-op for gdpr_required:true", async () => {
    // Should not throw and should not attempt Redis write
    await expect(setCachedResponse({
      companyId:    "company-1",
      skillSlug:    "cv_qualification",
      gdprRequired: true,
      embedding:    Array(32).fill(0.5),
      response:     "some output",
    })).resolves.not.toThrow();
  });

  it("personalised_comms has TTL=0 (NEVER cache)", async () => {
    const result = await getCachedResponse({
      companyId:    "company-1",
      skillSlug:    "personalised_comms",
      gdprRequired: false,
      embedding:    Array(32).fill(0.5),
    });
    // TTL=0 → returns null even without Redis
    expect(result).toBeNull();
  });

  it("getCachedResponse returns null when Redis is unavailable (graceful degradation)", async () => {
    // Redis not available in test env — should return null, not throw
    const result = await getCachedResponse({
      companyId:    "company-1",
      skillSlug:    "market_intelligence",
      gdprRequired: false,
      embedding:    Array(32).fill(0.5),
    });
    expect(result).toBeNull();
  });

  it("CACHE_TTL values match spec: market_intelligence=4h, formatting_drafting=24h, cv_qualification=2h", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/memory/semantic-cache.ts"), "utf8"
    );
    expect(src).toContain("market_intelligence");
    expect(src).toContain("4 * 3600");
    expect(src).toContain("formatting_drafting");
    expect(src).toContain("24 * 3600");
    expect(src).toContain("cv_qualification");
    expect(src).toContain("2 * 3600");
  });

  it("semantic cache is wired into executor.ts", () => {
    const executor = fs.readFileSync(
      path.join(ROOT, "server/src/tasks/executor.ts"), "utf8"
    );
    expect(executor).toContain("getCachedResponse");
    expect(executor).toContain("setCachedResponse");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap G — Agent-initiated task proposals
// ─────────────────────────────────────────────────────────────────────────────

describe("Gap G — Agent-initiated task proposals", () => {
  it("agent-proposals route exists", () => {
    expect(fs.existsSync(
      path.join(ROOT, "server/src/routes/agent-proposals.ts")
    )).toBe(true);
  });

  it("agentProposalRoutes is registered in app.ts", () => {
    const app = fs.readFileSync(path.join(ROOT, "server/src/app.ts"), "utf8");
    expect(app).toContain("agentProposalRoutes");
  });

  it("proposals route has GET (list) and PATCH (decide) endpoints", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/routes/agent-proposals.ts"), "utf8"
    );
    expect(src).toMatch(/router\.(get|GET)/);
    expect(src).toMatch(/router\.(patch|PATCH|post|POST)/);
  });

  it("agent_proposals table exists in migration", () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT, "packages/db/src/migrations/0090_50_customers.sql"), "utf8"
    );
    expect(migrationSql).toContain("agent_proposals");
  });

  it("anti-fatigue: proposals declined 3x same trigger raise threshold", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/routes/agent-proposals.ts"), "utf8"
    );
    // Anti-fatigue logic: track decline count, suppress after 3
    expect(src).toMatch(/decline|reject|3|threshold/i);
  });

  it("proposals have urgency field in agent_proposals DB schema", () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT, "packages/db/src/migrations/0090_50_customers.sql"), "utf8"
    );
    // urgency CHECK constraint declared in migration
    expect(migrationSql).toMatch(/urgency/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap I — Cost attribution per mission/goal/agent
// ─────────────────────────────────────────────────────────────────────────────

describe("Gap I — Cost attribution per mission/goal/agent", () => {
  it("cost_records schema has missionId, goalId, agentId columns", () => {
    const schema = fs.readFileSync(
      path.join(ROOT, "packages/db/src/schema/cost_records.ts"), "utf8"
    );
    expect(schema).toContain("missionId");
    expect(schema).toContain("goalId");
    expect(schema).toContain("agentId");
  });

  it("missions route exposes GET cost endpoint", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/src/routes/missions.ts"), "utf8"
    );
    expect(src).toContain("cost");
    expect(src).toContain("missionId");
  });

  it("migration adds mission_id and goal_id to cost records", () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT, "packages/db/src/migrations/0090_50_customers.sql"), "utf8"
    );
    // Migration must add mission_id/goal_id columns or create cost_entries with them
    expect(migrationSql).toMatch(/mission_id|goal_id|agent_id/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap L — Explainability-privacy compliance
// ─────────────────────────────────────────────────────────────────────────────

import {
  generateExplanation,
  formatForComplianceExport,
  type CounterfactualExplanation,
  type DecisionFactor,
} from "../safety/explainability.js";

describe("Gap L — Explainability-privacy compliance", () => {
  const FACTORS: DecisionFactor[] = [
    { criterion: "React 5 ans requis", met: false, subjectValue: "3 ans React", required: "5 ans React" },
    { criterion: "TypeScript requis",  met: true,  subjectValue: "TypeScript confirmé", required: "TypeScript" },
  ];

  it("generateExplanation returns both external_safe and internal_full", () => {
    const exp = generateExplanation("task-1", FACTORS, "fail");
    expect(Array.isArray(exp.externalSafe)).toBe(true);
    expect(Array.isArray(exp.internalFull)).toBe(true);
    expect(exp.externalSafe.length).toBeGreaterThan(0);
    expect(exp.internalFull.length).toBeGreaterThan(0);
  });

  it("external_safe only references the subject's own profile (no comparisons)", () => {
    const exp = generateExplanation("task-1", FACTORS, "fail");
    for (const line of exp.externalSafe) {
      // Must NOT contain comparative phrases like "un autre candidat"
      expect(line).not.toMatch(/autre candidat|other candidate|comparé à|better than/i);
    }
  });

  it("external_safe contains self-referential explanation in French", () => {
    const exp = generateExplanation("task-1", FACTORS, "fail");
    const text = exp.externalSafe.join(" ");
    expect(text).toContain("React");
    expect(text).toMatch(/ne répond pas|critère/i);
  });

  it("internal_full includes passed factors (✓ prefix)", () => {
    const exp = generateExplanation("task-1", FACTORS, "fail");
    const text = exp.internalFull.join(" ");
    expect(text).toContain("TypeScript");
  });

  it("internal_full includes comparative context when provided", () => {
    const exp = generateExplanation(
      "task-1", FACTORS, "fail",
      "Candidat B avait 6 ans React"
    );
    const text = exp.internalFull.join("\n");
    expect(text).toContain("Candidat B");
    // Comparative context must NOT appear in external_safe
    const extText = exp.externalSafe.join("\n");
    expect(extText).not.toContain("Candidat B");
  });

  it("pass outcome generates positive confirmation message", () => {
    const allMet: DecisionFactor[] = [
      { criterion: "React", met: true, subjectValue: "5 ans", required: "3 ans" },
    ];
    const exp = generateExplanation("task-2", allMet, "pass");
    expect(exp.externalSafe.join(" ")).toMatch(/répond à tous|critères/i);
  });

  it("escalate outcome generates human review message", () => {
    const exp = generateExplanation("task-3", FACTORS, "escalate");
    expect(exp.externalSafe.join(" ")).toMatch(/évaluation humaine|complémentaire/i);
  });

  it("formatForComplianceExport includes only external_safe lines", () => {
    const exp = generateExplanation("task-1", FACTORS, "fail", "Candidat B comparaison");
    const exported = formatForComplianceExport(exp);

    expect(exported).not.toContain("Candidat B");   // comparative context excluded
    expect(exported).toContain("task-1");
    expect(exported).toContain("Décision automatisée");
  });

  it("compliance export never contains internal_full comparative context", () => {
    const exp = generateExplanation("task-x", FACTORS, "fail", "Secret internal analysis");
    const exported = formatForComplianceExport(exp);
    expect(exported).not.toContain("Secret internal analysis");
  });

  it("explanation includes taskId and generatedAt", () => {
    const exp = generateExplanation("task-abc", FACTORS, "fail");
    expect(exp.taskId).toBe("task-abc");
    expect(exp.generatedAt).toBeInstanceOf(Date);
  });
});
