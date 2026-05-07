/**
 * G2 — Agent capability declaration
 *
 * Tests:
 *  1.  parseSkill — extracts purpose
 *  2.  parseSkill — extracts inputs with personalData flag
 *  3.  parseSkill — extracts outputSchema
 *  4.  parseSkill — extracts aiAct fields
 *  5.  parseSkill — extracts tools (MCP declarations)
 *  6.  parseSkill — extracts dataCategories
 *  7.  parseSkill — defaults aiAct to none/false when absent
 *  8.  parseSkill — inputs defaults to [] when absent
 *  9.  GET /capabilities — 200 with per-skill capability objects
 * 10.  GET /capabilities — 404 when agent not found
 * 11.  GET /capabilities — requiresGdpr true when any skill has gdpr_required
 * 12.  GET /capabilities — requiresGdpr false when no skill has gdpr_required
 * 13.  GET /capabilities — requiresWebAccess aggregated correctly
 * 14.  GET /capabilities — autonomyTier: A wins over B
 * 15.  GET /capabilities — aiActRiskLevel returns highest level across skills
 * 16.  GET /capabilities — empty skillSlugs returns empty skills array
 * 17.  installer stores tools in capabilityMetadata
 */

import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseSkill } from "../skills/parser.js";
import { errorHandler } from "../middleware/error-handler.js";

// ── Fixture IDs ────────────────────────────────────────────────────────────────

const COMPANY_ID = "c2000000-c200-4000-8000-c20000000000";
const USER_ID    = "u2000000-u200-4000-8000-u20000000000";
const AGENT_ID   = "a2000000-a200-4000-8000-a20000000000";

// ── SKILL.md fixtures ──────────────────────────────────────────────────────────

const GDPR_SKILL_MD = `---
name: qualification-cv
tier: 1
gdpr_required: true
web_access: false
autonomy_tier: A
purpose: "Évalue les CVs entrants pour une mission ouverte."
data_categories: [cv_data, contact_info]
inputs:
  - name: cv_document
    type: file
    required: true
    description: "CV du candidat"
    personal_data: true
  - name: job_posting_id
    type: string
    required: true
    description: "ID de la mission"
    personal_data: false
ai_act:
  risk_level: limited
  automated_decision: false
  profiling: true
  article_22_applicable: false
output_schema:
  type: object
  required: [score]
  properties:
    score: { type: number }
tools:
  - mcp: gmail
    permissions: [read]
---
Body
`;

const WEB_SKILL_MD = `---
name: market-intelligence
tier: 2
gdpr_required: false
web_access: true
web_scope: open
autonomy_tier: B
purpose: "Veille marché quotidienne."
data_categories: []
ai_act:
  risk_level: low
  automated_decision: false
  profiling: false
  article_22_applicable: false
---
Body
`;

const MINIMAL_SKILL_MD = `---
name: minimal-skill
tier: 1
---
Body
`;

// ── DB mock ────────────────────────────────────────────────────────────────────

function makeDb(agentRow: unknown, skillRows: unknown[]) {
  const queue = [agentRow ? [agentRow] : [], skillRows];
  let callCount = 0;

  const db: any = {};
  db.select = vi.fn().mockReturnValue(db);
  db.from   = vi.fn().mockReturnValue(db);
  db.where  = vi.fn().mockImplementation(() => {
    const rows = queue[callCount] ?? [];
    callCount++;
    return Promise.resolve(rows);
  });
  return db;
}

// ── App builder ───────────────────────────────────────────────────────────────

async function buildApp(agentRow: unknown, skillRows: unknown[]) {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: USER_ID,
      companyIds: [COMPANY_ID],
      source: "jwt",
      isInstanceAdmin: false,
      memberships: [{ companyId: COMPANY_ID, status: "active", membershipRole: "viewer" }],
    };
    (req as any).ctx = { userId: USER_ID, companyId: COMPANY_ID, role: "viewer", plan: "growth" };
    next();
  });

  const db = makeDb(agentRow, skillRows);
  const { agentConfigRoutes } = await import("../routes/agent-config.js");
  app.use("/api/v1", agentConfigRoutes(db));
  app.use(errorHandler);
  return app;
}

// ── Skill row builders ────────────────────────────────────────────────────────

function gdprSkillRow() {
  return {
    slug: "qualification-cv",
    name: "Qualification CV",
    metadata: {
      gdprRequired: true,
      webAccess: false,
      webScope: "open",
      autonomyTier: "A",
      purpose: "Évalue les CVs entrants pour une mission ouverte.",
      dataCategories: ["cv_data", "contact_info"],
      inputs: [
        { name: "cv_document", type: "file", required: true, description: "CV du candidat", personalData: true },
        { name: "job_posting_id", type: "string", required: true, description: "ID de la mission", personalData: false },
      ],
      outputSchema: { type: "object", required: ["score"], properties: { score: { type: "number" } } },
      aiAct: { riskLevel: "limited", automatedDecision: false, profiling: true, article22Applicable: false },
      tools: [{ mcp: "gmail", permissions: ["read"] }],
    },
  };
}

function webSkillRow() {
  return {
    slug: "market-intelligence",
    name: "Veille Marché",
    metadata: {
      gdprRequired: false,
      webAccess: true,
      webScope: "open",
      autonomyTier: "B",
      purpose: "Veille marché quotidienne.",
      dataCategories: [],
      inputs: [],
      outputSchema: null,
      aiAct: { riskLevel: "low", automatedDecision: false, profiling: false, article22Applicable: false },
      tools: [],
    },
  };
}

function agentRow(skillSlugs: string[]) {
  return {
    id: AGENT_ID,
    companyId: COMPANY_ID,
    name: "Sophie",
    metadata: { skillsAssigned: skillSlugs },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("G2 — Agent capability declaration", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── parseSkill parser tests ────────────────────────────────────────────────

  it("1. parseSkill — extracts purpose", () => {
    const parsed = parseSkill(GDPR_SKILL_MD);
    expect(parsed.purpose).toBe("Évalue les CVs entrants pour une mission ouverte.");
  });

  it("2. parseSkill — extracts inputs with personalData flag", () => {
    const parsed = parseSkill(GDPR_SKILL_MD);
    expect(parsed.inputs).toHaveLength(2);
    const cv = parsed.inputs.find((i) => i.name === "cv_document")!;
    expect(cv.type).toBe("file");
    expect(cv.required).toBe(true);
    expect(cv.personalData).toBe(true);
    const job = parsed.inputs.find((i) => i.name === "job_posting_id")!;
    expect(job.personalData).toBe(false);
  });

  it("3. parseSkill — extracts outputSchema", () => {
    const parsed = parseSkill(GDPR_SKILL_MD);
    expect(parsed.outputSchema).not.toBeNull();
    expect((parsed.outputSchema as any).type).toBe("object");
    expect((parsed.outputSchema as any).required).toContain("score");
  });

  it("4. parseSkill — extracts aiAct fields", () => {
    const parsed = parseSkill(GDPR_SKILL_MD);
    expect(parsed.aiAct.riskLevel).toBe("limited");
    expect(parsed.aiAct.automatedDecision).toBe(false);
    expect(parsed.aiAct.profiling).toBe(true);
    expect(parsed.aiAct.article22Applicable).toBe(false);
  });

  it("5. parseSkill — extracts tools (MCP declarations)", () => {
    const parsed = parseSkill(GDPR_SKILL_MD);
    expect(parsed.tools).toHaveLength(1);
    expect(parsed.tools[0].mcp).toBe("gmail");
    expect(parsed.tools[0].permissions).toContain("read");
  });

  it("6. parseSkill — extracts dataCategories", () => {
    const parsed = parseSkill(GDPR_SKILL_MD);
    expect(parsed.dataCategories).toContain("cv_data");
    expect(parsed.dataCategories).toContain("contact_info");
  });

  it("7. parseSkill — defaults aiAct to none/false when absent", () => {
    const parsed = parseSkill(MINIMAL_SKILL_MD);
    expect(parsed.aiAct.riskLevel).toBe("none");
    expect(parsed.aiAct.automatedDecision).toBe(false);
    expect(parsed.aiAct.profiling).toBe(false);
    expect(parsed.aiAct.article22Applicable).toBe(false);
  });

  it("8. parseSkill — inputs defaults to [] when absent", () => {
    const parsed = parseSkill(MINIMAL_SKILL_MD);
    expect(parsed.inputs).toEqual([]);
    expect(parsed.outputSchema).toBeNull();
    expect(parsed.tools).toEqual([]);
  });

  // ── Capabilities endpoint ──────────────────────────────────────────────────

  it("9. GET /capabilities — 200 with per-skill capability objects", async () => {
    const app = await buildApp(agentRow(["qualification-cv"]), [gdprSkillRow()]);
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/capabilities`);

    expect(res.status).toBe(200);
    expect(res.body.agentId).toBe(AGENT_ID);
    expect(Array.isArray(res.body.skills)).toBe(true);
    expect(res.body.skills).toHaveLength(1);

    const skill = res.body.skills[0];
    expect(skill.slug).toBe("qualification-cv");
    expect(skill.purpose).toBe("Évalue les CVs entrants pour une mission ouverte.");
    expect(skill.gdprRequired).toBe(true);
    expect(Array.isArray(skill.inputs)).toBe(true);
    expect(skill.outputSchema).not.toBeNull();
    expect(skill.aiAct.riskLevel).toBe("limited");
    expect(skill.tools).toHaveLength(1);
  });

  it("10. GET /capabilities — 404 when agent not found", async () => {
    const app = await buildApp(null, []);
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/capabilities`);
    expect(res.status).toBe(404);
  });

  it("11. GET /capabilities — requiresGdpr true when any skill has gdpr_required", async () => {
    const app = await buildApp(
      agentRow(["qualification-cv", "market-intelligence"]),
      [gdprSkillRow(), webSkillRow()],
    );
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/capabilities`);
    expect(res.status).toBe(200);
    expect(res.body.requiresGdpr).toBe(true);
  });

  it("12. GET /capabilities — requiresGdpr false when no skill has gdpr_required", async () => {
    const app = await buildApp(agentRow(["market-intelligence"]), [webSkillRow()]);
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/capabilities`);
    expect(res.status).toBe(200);
    expect(res.body.requiresGdpr).toBe(false);
  });

  it("13. GET /capabilities — requiresWebAccess aggregated correctly", async () => {
    const app = await buildApp(
      agentRow(["qualification-cv", "market-intelligence"]),
      [gdprSkillRow(), webSkillRow()],
    );
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/capabilities`);
    expect(res.body.requiresWebAccess).toBe(true);
  });

  it("14. GET /capabilities — autonomyTier: A wins over B", async () => {
    const app = await buildApp(
      agentRow(["qualification-cv", "market-intelligence"]),
      [gdprSkillRow(), webSkillRow()],
    );
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/capabilities`);
    // qualification-cv is tier A, market-intelligence is B → aggregate must be A
    expect(res.body.autonomyTier).toBe("A");
  });

  it("15. GET /capabilities — aiActRiskLevel returns highest level across skills", async () => {
    const app = await buildApp(
      agentRow(["qualification-cv", "market-intelligence"]),
      [gdprSkillRow(), webSkillRow()],
    );
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/capabilities`);
    // qualification-cv=limited, market-intelligence=low → highest is limited
    expect(res.body.aiActRiskLevel).toBe("limited");
  });

  it("16. GET /capabilities — empty skillSlugs returns empty skills array", async () => {
    const app = await buildApp(agentRow([]), []);
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/capabilities`);
    expect(res.status).toBe(200);
    expect(res.body.skills).toHaveLength(0);
    expect(res.body.requiresGdpr).toBe(false);
    expect(res.body.requiresWebAccess).toBe(false);
    expect(res.body.autonomyTier).toBe("B");
    expect(res.body.aiActRiskLevel).toBe("none");
  });

  it("17. parseSkill — webScope parsed correctly", () => {
    const parsed = parseSkill(WEB_SKILL_MD);
    expect(parsed.webAccess).toBe(true);
    expect(parsed.webScope).toBe("open");
    expect(parsed.autonomyTier).toBe("B");
    expect(parsed.gdprRequired).toBe(false);
  });
});
