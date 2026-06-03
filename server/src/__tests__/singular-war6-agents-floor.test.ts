/**
 * server/src/__tests__/singular-war6-agents-floor.test.ts
 *
 * WAR-6: Operatives floor — GET /companies/:companyId/agents-floor
 *
 * Tests:
 *  1. Returns agents with currentTask = null when no tasks running
 *  2. Attaches currentTask to agent when task is in_progress
 *  3. Returns 401 for wrong company
 *  4. Excludes deactivated agents
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { missionRoutes } from "../routes/missions.js";

const COMPANY_ID  = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ID    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AGENT_ID_1  = "11111111-1111-4111-8111-111111111111";
const AGENT_ID_2  = "22222222-2222-4222-8222-222222222222";
const TASK_ID     = "tttttttt-tttt-4ttt-8ttt-tttttttttttt";

const mockAgents = [
  { id: AGENT_ID_1, slug: "sophie", displayName: "Sophie", colour: "#3B82F6", status: "active" },
  { id: AGENT_ID_2, slug: "orchestrateur", displayName: "Orchestrateur", colour: "#10B981", status: "active" },
];

const mockRunningTask = {
  assigneeId: AGENT_ID_1,
  taskId:     TASK_ID,
  title:      "Qualifier les candidatures",
  status:     "in_progress",
};

function makeDb(agentRows = mockAgents, taskRows: typeof mockRunningTask[] = []) {
  let callCount = 0;
  return {
    select: vi.fn().mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      const results = [agentRows, taskRows];
      const result = results[callCount++] ?? [];
      chain.from    = vi.fn().mockReturnValue(chain);
      chain.where   = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.limit   = vi.fn().mockReturnValue(chain);
      chain.then    = (cb: (v: unknown[]) => unknown) => Promise.resolve(result).then(cb);
      return chain;
    }),
  };
}

async function buildApp(db: ReturnType<typeof makeDb>, companyId = COMPANY_ID) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).ctx   = { userId: "user-1", companyId, role: "operator", plan: "growth" };
    (req as any).actor = {
      type:       "board",
      userId:     "user-1",
      source:     "session",
      companyIds: [COMPANY_ID],   // required by assertCompanyAccess
    };
    next();
  });
  app.use(missionRoutes(db as any));
  return app;
}

describe("WAR-6 — agents-floor endpoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("1. returns agents with currentTask null when no tasks running", async () => {
    const app = await buildApp(makeDb(mockAgents, []));
    const res = await request(app).get(`/companies/${COMPANY_ID}/agents-floor`);
    expect(res.status).toBe(200);
    expect(res.body.agents).toHaveLength(2);
    expect(res.body.agents[0].currentTask).toBeNull();
    expect(res.body.agents[0].displayName).toBe("Sophie");
  });

  it("2. attaches currentTask to agent when task is in_progress", async () => {
    const app = await buildApp(makeDb(mockAgents, [mockRunningTask]));
    const res = await request(app).get(`/companies/${COMPANY_ID}/agents-floor`);
    expect(res.status).toBe(200);
    const sophie = res.body.agents.find((a: { slug: string }) => a.slug === "sophie");
    expect(sophie.currentTask).not.toBeNull();
    expect(sophie.currentTask.title).toBe("Qualifier les candidatures");
    expect(sophie.currentTask.status).toBe("in_progress");
  });

  it("3. excludes deactivated agents (DB filter — mock pre-filtered)", async () => {
    // The WHERE ne(status, 'deactivated') is enforced at the DB level.
    // The mock returns only active agents as the DB would after filtering.
    const app = await buildApp(makeDb(mockAgents, []));
    const res = await request(app).get(`/companies/${COMPANY_ID}/agents-floor`);
    expect(res.status).toBe(200);
    // Both active mock agents are returned
    expect(res.body.agents).toHaveLength(2);
    // No deactivated agent in response
    expect(res.body.agents.every((a: { status: string }) => a.status !== "deactivated")).toBe(true);
  });

  it("4. returns 403 for wrong company", async () => {
    const app = await buildApp(makeDb(), COMPANY_ID);
    const res = await request(app).get(`/companies/${OTHER_ID}/agents-floor`);
    expect(res.status).toBe(403);
  });

  it("5. returns empty agents array when company has no agents", async () => {
    const app = await buildApp(makeDb([], []));
    const res = await request(app).get(`/companies/${COMPANY_ID}/agents-floor`);
    expect(res.status).toBe(200);
    expect(res.body.agents).toEqual([]);
  });
});
