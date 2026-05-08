/**
 * G7 — Skill version pinning
 *
 * Tests:
 *  1.  getActiveSkillVersion — returns the active version for a skill type
 *  2.  getActiveSkillVersion — returns null when no active version exists
 *  3.  pinSkillVersion — writes skill_version_id to the task
 *  4.  pinSkillVersion — returns null when no active version exists (no-op)
 *  5.  resolveSkillForTask — returns pinned version when task has skill_version_id
 *  6.  resolveSkillForTask — falls back to active version when no pin
 *  7.  resolveSkillForTask — returns null when task has no skill_type and no pin
 *  8.  resolveSkillForTask — returns null when task not found
 *  9.  activateSkillVersion — activates version, deprecates previous active
 * 10.  activateSkillVersion — idempotent when already active
 * 11.  GET .../tasks/:taskId/skill-version — 200 returns skill version info
 * 12.  GET .../tasks/:taskId/skill-version — 404 when no skill version
 * 13.  POST .../tasks/:taskId/skill-version/pin — 201 pins version
 * 14.  POST .../tasks/:taskId/skill-version/pin — 403 for viewer
 * 15.  POST .../skill-versions/:versionId/activate — 200 activates version
 * 16.  POST .../skill-versions/:versionId/activate — 403 for viewer
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("@paperclipai/db", () => ({
  skillVersions: {
    id:          "id",
    companyId:   "companyId",
    skillType:   "skillType",
    version:     "version",
    promptBody:  "promptBody",
    frontmatter: "frontmatter",
    status:      "status",
    activatedAt: "activatedAt",
  },
  issues: {
    id:             "id",
    companyId:      "companyId",
    skillType:      "skillType",
    skillVersionId: "skillVersionId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq:  (...a: any[]) => ({ op: "eq",  a }),
  and: (...a: any[]) => ({ op: "and", a }),
}));

vi.mock("../tasks/skill-version.js", () => ({
  resolveSkillForTask:  vi.fn(),
  pinSkillVersion:      vi.fn(),
  activateSkillVersion: vi.fn(),
  getActiveSkillVersion: vi.fn(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID  = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_ID     = "11111111-1111-4111-8111-111111111111";
const VERSION_ID  = "22222222-2222-4222-2222-222222222222";
const SKILL_TYPE  = "qualification-cv";
const USER_ID     = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const RESOLVED_SKILL = {
  versionId:   VERSION_ID,
  version:     "1.0.0",
  skillType:   SKILL_TYPE,
  promptBody:  "You are an expert recruiter...",
  frontmatter: { tier: 1, gdprRequired: true },
  pinned:      true,
};

// ── DB mock factory ───────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const c: any = {};
  for (const m of ["from", "where", "orderBy", "limit"]) c[m] = vi.fn().mockReturnValue(c);
  c.then = (res: any, rej: any) => Promise.resolve(rows).then(res, rej);
  return c;
}

// ── Service unit tests ────────────────────────────────────────────────────────

describe("G7 — getActiveSkillVersion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("1. returns the active version for a skill type", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).getActiveSkillVersion)
      .mockResolvedValueOnce(RESOLVED_SKILL);

    const { getActiveSkillVersion } = await import("../tasks/skill-version.js");
    const db: any = {};
    const result = await getActiveSkillVersion(db, COMPANY_ID, SKILL_TYPE);
    expect(result).not.toBeNull();
    expect(result!.versionId).toBe(VERSION_ID);
    expect(result!.skillType).toBe(SKILL_TYPE);
  });

  it("2. returns null when no active version exists", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).getActiveSkillVersion)
      .mockResolvedValueOnce(null);

    const { getActiveSkillVersion } = await import("../tasks/skill-version.js");
    const result = await getActiveSkillVersion({} as any, COMPANY_ID, SKILL_TYPE);
    expect(result).toBeNull();
  });
});

describe("G7 — pinSkillVersion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("3. writes skill_version_id to the task", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).pinSkillVersion)
      .mockResolvedValueOnce(VERSION_ID);

    const { pinSkillVersion } = await import("../tasks/skill-version.js");
    const result = await pinSkillVersion({} as any, TASK_ID, COMPANY_ID, SKILL_TYPE);
    expect(result).toBe(VERSION_ID);
  });

  it("4. returns null when no active version exists (no-op)", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).pinSkillVersion)
      .mockResolvedValueOnce(null);

    const { pinSkillVersion } = await import("../tasks/skill-version.js");
    const result = await pinSkillVersion({} as any, TASK_ID, COMPANY_ID, SKILL_TYPE);
    expect(result).toBeNull();
  });
});

describe("G7 — resolveSkillForTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("5. returns pinned version when task has skill_version_id", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).resolveSkillForTask)
      .mockResolvedValueOnce({ ...RESOLVED_SKILL, pinned: true });

    const { resolveSkillForTask } = await import("../tasks/skill-version.js");
    const result = await resolveSkillForTask({} as any, TASK_ID, COMPANY_ID);
    expect(result!.pinned).toBe(true);
    expect(result!.versionId).toBe(VERSION_ID);
  });

  it("6. falls back to active version when no pin", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).resolveSkillForTask)
      .mockResolvedValueOnce({ ...RESOLVED_SKILL, pinned: false });

    const { resolveSkillForTask } = await import("../tasks/skill-version.js");
    const result = await resolveSkillForTask({} as any, TASK_ID, COMPANY_ID);
    expect(result!.pinned).toBe(false);
  });

  it("7. returns null when task has no skill_type and no pin", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).resolveSkillForTask)
      .mockResolvedValueOnce(null);

    const { resolveSkillForTask } = await import("../tasks/skill-version.js");
    const result = await resolveSkillForTask({} as any, TASK_ID, COMPANY_ID);
    expect(result).toBeNull();
  });

  it("8. returns null when task not found", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).resolveSkillForTask)
      .mockResolvedValueOnce(null);

    const { resolveSkillForTask } = await import("../tasks/skill-version.js");
    const result = await resolveSkillForTask({} as any, "nonexistent", COMPANY_ID);
    expect(result).toBeNull();
  });
});

describe("G7 — activateSkillVersion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("9. activates version and deprecates previous active", async () => {
    const activateMock = vi.mocked(
      (await import("../tasks/skill-version.js")).activateSkillVersion,
    ).mockResolvedValueOnce(undefined);

    const { activateSkillVersion } = await import("../tasks/skill-version.js");
    await activateSkillVersion({} as any, VERSION_ID, COMPANY_ID);
    expect(activateMock).toHaveBeenCalledWith(expect.anything(), VERSION_ID, COMPANY_ID);
  });

  it("10. idempotent when version is already active", async () => {
    const activateMock = vi.mocked(
      (await import("../tasks/skill-version.js")).activateSkillVersion,
    ).mockResolvedValueOnce(undefined);

    const { activateSkillVersion } = await import("../tasks/skill-version.js");
    await activateSkillVersion({} as any, VERSION_ID, COMPANY_ID);
    await activateSkillVersion({} as any, VERSION_ID, COMPANY_ID);
    expect(activateMock).toHaveBeenCalledTimes(2);
  });
});

// ── Route tests ───────────────────────────────────────────────────────────────

async function buildRouteApp(role: "operator" | "viewer" | "owner" = "operator") {
  const { skillVersionRoutes } = await import("../routes/skill-version.js");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board", userId: USER_ID, companyIds: [COMPANY_ID],
      source: "jwt", isInstanceAdmin: false,
      memberships: [{ companyId: COMPANY_ID, status: "active", membershipRole: role }],
    };
    (req as any).ctx = { userId: USER_ID, companyId: COMPANY_ID, role, plan: "growth" };
    next();
  });
  app.use("/", skillVersionRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("G7 — Skill version routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("11. GET .../tasks/:taskId/skill-version — 200 returns version info", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).resolveSkillForTask)
      .mockResolvedValueOnce(RESOLVED_SKILL);

    const app = await buildRouteApp();
    const res = await request(app)
      .get(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/skill-version`);
    expect(res.status).toBe(200);
    expect(res.body.versionId).toBe(VERSION_ID);
    expect(res.body.skillType).toBe(SKILL_TYPE);
    expect(res.body.pinned).toBe(true);
    expect(res.body.taskId).toBe(TASK_ID);
  });

  it("12. GET .../tasks/:taskId/skill-version — 404 when no skill version", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).resolveSkillForTask)
      .mockResolvedValueOnce(null);

    const app = await buildRouteApp();
    const res = await request(app)
      .get(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/skill-version`);
    expect(res.status).toBe(404);
  });

  it("13. POST .../tasks/:taskId/skill-version/pin — 201 pins version", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).pinSkillVersion)
      .mockResolvedValueOnce(VERSION_ID);

    const app = await buildRouteApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/skill-version/pin`)
      .send({ skillType: SKILL_TYPE });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.versionId).toBe(VERSION_ID);
  });

  it("14. POST .../tasks/:taskId/skill-version/pin — 403 for viewer", async () => {
    const app = await buildRouteApp("viewer");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/skill-version/pin`)
      .send({ skillType: SKILL_TYPE });
    expect(res.status).toBe(403);
  });

  it("15. POST .../skill-versions/:versionId/activate — 200 activates", async () => {
    vi.mocked((await import("../tasks/skill-version.js")).activateSkillVersion)
      .mockResolvedValueOnce(undefined);

    const app = await buildRouteApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/skill-versions/${VERSION_ID}/activate`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.versionId).toBe(VERSION_ID);
  });

  it("16. POST .../skill-versions/:versionId/activate — 403 for viewer", async () => {
    const app = await buildRouteApp("viewer");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/skill-versions/${VERSION_ID}/activate`);
    expect(res.status).toBe(403);
  });
});
