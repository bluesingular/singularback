/**
 * Gap F — Agent configuration UI
 *
 * Tests:
 *  1. parseSkill — parses config_params with all field types
 *  2. parseSkill — config_params defaults to [] when absent
 *  3. parseSkill — skips config_params entries with unknown type
 *  4. parseSkill — skips config_params entries missing name
 *  5. validateParamValue — select: accepts valid option
 *  6. validateParamValue — select: rejects value not in options
 *  7. validateParamValue — number: accepts in-range value
 *  8. validateParamValue — number: rejects below min
 *  9. validateParamValue — number: rejects above max
 * 10. validateParamValue — toggle: accepts boolean
 * 11. validateParamValue — toggle: rejects non-boolean
 * 12. validateParamValue — text_list: accepts string array
 * 13. validateParamValue — text_list: rejects non-array
 * 14. GET /agents/:id/config — 200 with configParams and currentValues
 * 15. GET /agents/:id/config — 404 when agent not found
 * 16. GET /agents/:id/config — currentValues use defaults when runtimeConfig empty
 * 17. GET /agents/:id/config — currentValues prefer runtimeConfig over defaults
 * 18. PUT /agents/:id/config — 200 and merges into runtimeConfig
 * 19. PUT /agents/:id/config — 422 when value violates select constraint
 * 20. PUT /agents/:id/config — 422 when value violates number min
 * 21. PUT /agents/:id/config — 422 when unknown param key submitted
 * 22. PUT /agents/:id/config — 404 when agent not found
 * 23. parseConfigParams — parses select type with options
 * 24. parseConfigParams — parses number type with min/max
 * 25. parseConfigParams — parses toggle with boolean default
 */

import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseSkill } from "../skills/parser.js";
import { errorHandler } from "../middleware/error-handler.js";

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENT_ID   = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SKILL_KEY  = "qualification-cv";

// ── Skill markdown with config_params ────────────────────────────────────────

const SKILL_WITH_CONFIG = `---
name: test-skill
tier: 1
gdpr_required: false
config_params:
  - name: ton
    type: select
    label: "Ton de communication"
    options: ["professionnel", "chaleureux"]
    default: "professionnel"
  - name: max_par_lot
    type: number
    label: "Maximum par lot"
    min: 1
    max: 50
    default: 10
  - name: activer_relance
    type: toggle
    label: "Activer les relances automatiques"
    default: true
  - name: note_interne
    type: text
    label: "Note interne"
    placeholder: "Optionnel"
    default: ""
  - name: domaines_exclus
    type: text_list
    label: "Domaines exclus"
    default: []
---
Body
`;

const SKILL_WITHOUT_CONFIG = `---
name: no-config-skill
tier: 1
---
Body
`;

// ── Parser tests ──────────────────────────────────────────────────────────────

describe("Gap F — parser: config_params", () => {
  it("1. parses config_params with all field types", () => {
    const parsed = parseSkill(SKILL_WITH_CONFIG);
    expect(parsed.configParams).toHaveLength(5);

    const select = parsed.configParams.find((p) => p.name === "ton")!;
    expect(select.type).toBe("select");
    expect(select.label).toBe("Ton de communication");
    expect(select.options).toEqual(["professionnel", "chaleureux"]);
    expect(select.default).toBe("professionnel");

    const num = parsed.configParams.find((p) => p.name === "max_par_lot")!;
    expect(num.type).toBe("number");
    expect(num.min).toBe(1);
    expect(num.max).toBe(50);
    expect(num.default).toBe(10);

    const toggle = parsed.configParams.find((p) => p.name === "activer_relance")!;
    expect(toggle.type).toBe("toggle");
    expect(toggle.default).toBe(true);
  });

  it("2. config_params defaults to [] when absent", () => {
    const parsed = parseSkill(SKILL_WITHOUT_CONFIG);
    expect(parsed.configParams).toEqual([]);
  });

  it("3. skips entries with unknown type", () => {
    const md = `---
name: bad-type-skill
tier: 1
config_params:
  - name: good_field
    type: text
    label: "Bon champ"
    default: ""
  - name: bad_field
    type: unknown_type
    label: "Mauvais type"
    default: ""
---
Body`;
    const parsed = parseSkill(md);
    expect(parsed.configParams).toHaveLength(1);
    expect(parsed.configParams[0].name).toBe("good_field");
  });

  it("4. skips entries missing name", () => {
    const md = `---
name: no-name-skill
tier: 1
config_params:
  - type: text
    label: "Sans nom"
    default: ""
---
Body`;
    const parsed = parseSkill(md);
    expect(parsed.configParams).toHaveLength(0);
  });

  it("23. parses select type with options", () => {
    const parsed = parseSkill(SKILL_WITH_CONFIG);
    const param = parsed.configParams.find((p) => p.type === "select")!;
    expect(param.options).toBeDefined();
    expect(Array.isArray(param.options)).toBe(true);
    expect(param.options!.length).toBeGreaterThan(0);
  });

  it("24. parses number type with min/max", () => {
    const parsed = parseSkill(SKILL_WITH_CONFIG);
    const param = parsed.configParams.find((p) => p.type === "number")!;
    expect(typeof param.min).toBe("number");
    expect(typeof param.max).toBe("number");
    expect(param.min!).toBeLessThan(param.max!);
  });

  it("25. parses toggle with boolean default", () => {
    const parsed = parseSkill(SKILL_WITH_CONFIG);
    const param = parsed.configParams.find((p) => p.type === "toggle")!;
    expect(typeof param.default).toBe("boolean");
  });
});

// ── Route tests ───────────────────────────────────────────────────────────────

const CONFIG_PARAMS = [
  {
    name: "ton",
    type: "select",
    label: "Ton",
    options: ["professionnel", "chaleureux"],
    default: "professionnel",
  },
  {
    name: "max_par_lot",
    type: "number",
    label: "Max par lot",
    min: 1,
    max: 50,
    default: 10,
  },
];

function makeAgentRow(runtimeConfig: Record<string, unknown> = {}) {
  return {
    id: AGENT_ID,
    companyId: COMPANY_ID,
    name: "Sophie",
    metadata: { skillsAssigned: [SKILL_KEY] },
    runtimeConfig,
  };
}

function makeSkillRow() {
  return {
    slug: SKILL_KEY,
    metadata: { configParams: CONFIG_PARAMS },
  };
}

async function buildApp(
  agentRows: unknown[],
  skillRows: unknown[],
) {
  const app = express();
  app.use(express.json());

  // Auth stub
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: [COMPANY_ID],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    (req as any).ctx = {
      userId: "user-1",
      companyId: COMPANY_ID,
      role: "operator",
      plan: "growth",
    };
    next();
  });

  let callCount = 0;
  const mockDb: any = {
    select: vi.fn().mockImplementation(() => mockDb),
    from: vi.fn().mockImplementation(() => mockDb),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      // First select = agent lookup, second = skill lookup
      if (callCount % 2 === 1) return Promise.resolve(agentRows);
      return Promise.resolve(skillRows);
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  const { agentConfigRoutes } = await import("../routes/agent-config.js");
  app.use("/api/v1", agentConfigRoutes(mockDb));
  app.use(errorHandler);
  return app;
}

describe("Gap F — agent config routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("14. GET /config — 200 with configParams and currentValues", async () => {
    const app = await buildApp([makeAgentRow()], [makeSkillRow()]);
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.configParams)).toBe(true);
    expect(res.body.configParams.length).toBeGreaterThan(0);
    expect(res.body.currentValues).toBeDefined();
  });

  it("15. GET /config — 404 when agent not found", async () => {
    const app = await buildApp([], []);
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`);

    expect(res.status).toBe(404);
  });

  it("16. GET /config — currentValues use defaults when runtimeConfig empty", async () => {
    const app = await buildApp([makeAgentRow({})], [makeSkillRow()]);
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`);

    expect(res.status).toBe(200);
    expect(res.body.currentValues.ton).toBe("professionnel");
    expect(res.body.currentValues.max_par_lot).toBe(10);
  });

  it("17. GET /config — currentValues prefer runtimeConfig over defaults", async () => {
    const app = await buildApp(
      [makeAgentRow({ ton: "chaleureux", max_par_lot: 25 })],
      [makeSkillRow()],
    );
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`);

    expect(res.status).toBe(200);
    expect(res.body.currentValues.ton).toBe("chaleureux");
    expect(res.body.currentValues.max_par_lot).toBe(25);
  });

  it("18. PUT /config — 200 and merges into runtimeConfig", async () => {
    const app = await buildApp([makeAgentRow()], [makeSkillRow()]);
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ ton: "chaleureux", max_par_lot: 15 });

    expect(res.status).toBe(200);
    expect(res.body.runtimeConfig.ton).toBe("chaleureux");
    expect(res.body.runtimeConfig.max_par_lot).toBe(15);
  });

  it("19. PUT /config — 422 when value violates select constraint", async () => {
    const app = await buildApp([makeAgentRow()], [makeSkillRow()]);
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ ton: "inconnu" });

    expect(res.status).toBe(422);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it("20. PUT /config — 422 when value violates number min", async () => {
    const app = await buildApp([makeAgentRow()], [makeSkillRow()]);
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ max_par_lot: 0 });

    expect(res.status).toBe(422);
    expect(res.body.errors[0]).toContain("minimum");
  });

  it("21. PUT /config — 422 when unknown param key submitted", async () => {
    const app = await buildApp([makeAgentRow()], [makeSkillRow()]);
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ parametre_inconnu: "valeur" });

    expect(res.status).toBe(422);
    expect(res.body.errors[0]).toContain("inconnu");
  });

  it("22. PUT /config — 404 when agent not found", async () => {
    const app = await buildApp([], []);
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ ton: "chaleureux" });

    expect(res.status).toBe(404);
  });

  it("5. validateParamValue — select accepts valid option", async () => {
    const app = await buildApp([makeAgentRow()], [makeSkillRow()]);
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ ton: "professionnel" });
    expect(res.status).toBe(200);
  });

  it("6. validateParamValue — select rejects value not in options", async () => {
    const app = await buildApp([makeAgentRow()], [makeSkillRow()]);
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ ton: "agressif" });
    expect(res.status).toBe(422);
  });

  it("7. validateParamValue — number accepts in-range value", async () => {
    const app = await buildApp([makeAgentRow()], [makeSkillRow()]);
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ max_par_lot: 25 });
    expect(res.status).toBe(200);
  });

  it("8. validateParamValue — number rejects below min", async () => {
    const app = await buildApp([makeAgentRow()], [makeSkillRow()]);
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ max_par_lot: 0 });
    expect(res.status).toBe(422);
  });

  it("9. validateParamValue — number rejects above max", async () => {
    const app = await buildApp([makeAgentRow()], [makeSkillRow()]);
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ max_par_lot: 99 });
    expect(res.status).toBe(422);
  });
});
