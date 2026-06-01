/**
 * Gap D — Skill management system (admin routes)
 *
 * Tests:
 *  1. GET /admin/skills/pending -- 200 with version list (instance admin)
 *  2. GET /admin/skills/pending -- 403 when not instance admin
 *  3. GET /admin/skills/:skillType/versions -- 200 with versions
 *  4. GET /admin/skills/:skillType/versions -- 400 when companyId missing
 *  5. POST /admin/skills/:skillType/versions -- 201 creates draft version
 *  6. POST /admin/skills/:skillType/versions -- 400 when companyId missing
 *  7. GET /admin/skills/:skillType/versions/:id -- 200 with version + parent
 *  8. GET /admin/skills/:skillType/versions/:id -- 404 when not found
 *  9. PATCH /admin/skills/:skillType/versions/:id -- 200 updates draft
 * 10. PATCH -- 400 when status is not editable (active)
 * 11. POST .../publish -- 200 advances status (draft → review)
 * 12. POST .../publish -- 400 when status cannot advance (active)
 * 13. POST .../approve -- 200 approves pending_approval version
 * 14. POST .../approve -- 400 when not pending_approval
 * 15. POST .../reject -- 200 rejects version → blocked
 * 16. POST .../rollback -- 200 re-activates deprecated version
 * 17. GET /admin/skills/:skillType/golden-datasets -- 200
 * 18. POST /admin/skills/:skillType/golden-datasets -- 201 with valid body
 * 19. DELETE /admin/skills/:skillType/golden-datasets/:itemId -- 200
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Static mocks (must be declared before any imports from the mocked modules) ─

vi.mock("@paperclipai/db", () => ({
  skillVersions: {
    id: "id", companyId: "companyId", skillType: "skillType", version: "version",
    status: "status", promptBody: "promptBody", frontmatter: "frontmatter",
    benchmarkScore: "benchmarkScore", triggerReason: "triggerReason",
    parentVersionId: "parentVersionId", activatedAt: "activatedAt",
    createdAt: "createdAt", benchmarkItemCount: "benchmarkItemCount",
  },
  goldenDatasets: {
    id: "id", companyId: "companyId", skillType: "skillType",
    input: "input", expectedOutput: "expectedOutput",
    qualityScore: "qualityScore", notes: "notes", createdAt: "createdAt",
  },
  companies: { id: "id", name: "name" },
}));

vi.mock("drizzle-orm", () => ({
  eq:     (...args: any[]) => ({ op: "eq",     args }),
  and:    (...args: any[]) => ({ op: "and",    args }),
  ne:     (...args: any[]) => ({ op: "ne",     args }),
  isNull: (...args: any[]) => ({ op: "isNull", args }),
  desc:   (...args: any[]) => ({ op: "desc",   args }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VERSION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ITEM_ID    = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SKILL_TYPE = "qualification-cv";

// ── DB mock factory ───────────────────────────────────────────────────────────

function makeDb(opts: {
  status?: string
  withParent?: boolean
  notFound?: boolean
  goldenItems?: object[]
} = {}) {
  const { status = "draft", withParent = false, notFound = false, goldenItems } = opts;

  const versionRow = {
    id: VERSION_ID, companyId: COMPANY_ID, skillType: SKILL_TYPE,
    version: "1.0.0", status, promptBody: "hello world",
    frontmatter: {}, benchmarkScore: null, triggerReason: "manual",
    parentVersionId: withParent ? "pppp-pppp-pppp-pppp" : null,
    createdAt: new Date().toISOString(),
  };
  const parentRow = { id: "pppp-pppp-pppp-pppp", version: "0.9.0", promptBody: "old prompt" };
  const itemRow   = {
    id: ITEM_ID, companyId: COMPANY_ID, skillType: SKILL_TYPE,
    input: { cv: "test" }, expectedOutput: { score: 4 }, qualityScore: 4, notes: null,
  };

  let selectCount = 0;
  const chain: any = {};
  const thenable = () => chain;
  for (const m of ["from", "where", "orderBy", "innerJoin", "leftJoin"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject: any) => {
    const rows = notFound ? [] : goldenItems ? goldenItems : [versionRow];
    return Promise.resolve(rows).then(resolve, reject);
  };
  chain.limit = vi.fn().mockImplementation(() => {
    selectCount++;
    if (notFound) return Promise.resolve([]);
    // 2nd select = parent lookup
    if (selectCount === 2 && withParent) return Promise.resolve([parentRow]);
    return Promise.resolve([versionRow]);
  });

  return {
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([versionRow]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...versionRow, status: "review" }]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ── App builder ───────────────────────────────────────────────────────────────

async function buildApp(opts: Parameters<typeof makeDb>[0] = {}, isAdmin = true) {
  const db = makeDb(opts);
  const { adminSkillRoutes } = await import("../routes/admin-skills.js");
  const router = adminSkillRoutes(db as any);

  const app = express();
  app.use(express.json());

  // Inject actor so assertBoard / assertInstanceAdmin pass
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: [COMPANY_ID],
      source: "jwt",
      isInstanceAdmin: isAdmin,
      memberships: [],
    };
    next();
  });

  app.use("/", router);
  app.use(errorHandler);
  return { app, db };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe("Gap D — Admin skill routes", () => {
  it("1. GET /admin/skills/pending — 200 with versions", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/admin/skills/pending");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("versions");
  });

  it("2. GET /admin/skills/pending — 403 when not admin", async () => {
    const { app } = await buildApp({}, false);
    const res = await request(app).get("/admin/skills/pending");
    expect(res.status).toBe(403);
  });

  it("3. GET /admin/skills/:skillType/versions — 200", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .get(`/admin/skills/${SKILL_TYPE}/versions?companyId=${COMPANY_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("versions");
    expect(res.body.skillType).toBe(SKILL_TYPE);
  });

  it("4. GET /admin/skills/:skillType/versions — 400 when no companyId", async () => {
    const { app } = await buildApp();
    const res = await request(app).get(`/admin/skills/${SKILL_TYPE}/versions`);
    expect(res.status).toBe(400);
  });

  it("5. POST /admin/skills/:skillType/versions — 201 creates draft", async () => {
    const { app } = await buildApp({ status: "draft" });
    const res = await request(app)
      .post(`/admin/skills/${SKILL_TYPE}/versions?companyId=${COMPANY_ID}`)
      .send({ version: "2.0.0", promptBody: "New prompt", frontmatter: {} });
    expect(res.status).toBe(201);
    expect(res.body.version.status).toBe("draft");
  });

  it("6. POST /admin/skills/:skillType/versions — 400 when no companyId", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post(`/admin/skills/${SKILL_TYPE}/versions`)
      .send({ version: "2.0.0", promptBody: "prompt" });
    expect(res.status).toBe(400);
  });

  it("7. GET /admin/skills/:skillType/versions/:id — 200 with version", async () => {
    const { app } = await buildApp({ withParent: true });
    const res = await request(app)
      .get(`/admin/skills/${SKILL_TYPE}/versions/${VERSION_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("version");
  });

  it("8. GET /admin/skills/:skillType/versions/:id — 404 when not found", async () => {
    const { app } = await buildApp({ notFound: true });
    const res = await request(app)
      .get(`/admin/skills/${SKILL_TYPE}/versions/${VERSION_ID}`);
    expect(res.status).toBe(404);
  });

  it("9. PATCH /admin/skills/:skillType/versions/:id — 200 updates draft", async () => {
    const { app } = await buildApp({ status: "draft" });
    const res = await request(app)
      .patch(`/admin/skills/${SKILL_TYPE}/versions/${VERSION_ID}`)
      .send({ promptBody: "Updated prompt" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("version");
  });

  it("10. PATCH — 400 when status is active (not editable)", async () => {
    const { app } = await buildApp({ status: "active" });
    const res = await request(app)
      .patch(`/admin/skills/${SKILL_TYPE}/versions/${VERSION_ID}`)
      .send({ promptBody: "Updated" });
    expect(res.status).toBe(400);
  });

  it("11. POST .../publish — 200 advances draft → review", async () => {
    const { app } = await buildApp({ status: "draft" });
    const res = await request(app)
      .post(`/admin/skills/${SKILL_TYPE}/versions/${VERSION_ID}/publish`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("version");
  });

  it("12. POST .../publish — 400 when active (cannot advance further)", async () => {
    const { app } = await buildApp({ status: "active" });
    const res = await request(app)
      .post(`/admin/skills/${SKILL_TYPE}/versions/${VERSION_ID}/publish`);
    expect(res.status).toBe(400);
  });

  it("13. POST .../approve — 200 approves pending_approval", async () => {
    const { app } = await buildApp({ status: "pending_approval" });
    const res = await request(app)
      .post(`/admin/skills/${SKILL_TYPE}/versions/${VERSION_ID}/approve`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("version");
  });

  it("14. POST .../approve — 400 when not pending_approval", async () => {
    const { app } = await buildApp({ status: "draft" });
    const res = await request(app)
      .post(`/admin/skills/${SKILL_TYPE}/versions/${VERSION_ID}/approve`);
    expect(res.status).toBe(400);
  });

  it("15. POST .../reject — 200 → blocked", async () => {
    const { app } = await buildApp({ status: "pending_approval" });
    const res = await request(app)
      .post(`/admin/skills/${SKILL_TYPE}/versions/${VERSION_ID}/reject`);
    expect(res.status).toBe(200);
  });

  it("16. POST .../rollback — 200 re-activates deprecated", async () => {
    const { app } = await buildApp({ status: "deprecated" });
    const res = await request(app)
      .post(`/admin/skills/${SKILL_TYPE}/versions/${VERSION_ID}/rollback`);
    expect(res.status).toBe(200);
  });

  it("17. GET /admin/skills/:skillType/golden-datasets — 200", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .get(`/admin/skills/${SKILL_TYPE}/golden-datasets?companyId=${COMPANY_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
  });

  it("18. POST /admin/skills/:skillType/golden-datasets — 201", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post(`/admin/skills/${SKILL_TYPE}/golden-datasets?companyId=${COMPANY_ID}`)
      .send({ input: { cv: "test" }, expectedOutput: { score: 4 }, qualityScore: 4 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("item");
  });

  it("19. DELETE /admin/skills/:skillType/golden-datasets/:itemId — 200", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .delete(`/admin/skills/${SKILL_TYPE}/golden-datasets/${ITEM_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
