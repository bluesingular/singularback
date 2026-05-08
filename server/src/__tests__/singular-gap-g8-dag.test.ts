/**
 * G8 — Task DAG service unit tests (tests 1–11)
 *
 * Route tests (12–16) are in singular-gap-g8-dag-routes.test.ts
 * because vi.mock("../tasks/dag.js") would be hoisted and shadow
 * the real implementation needed here.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("@paperclipai/db", () => ({
  issueRelations: {
    issueId:        "issueId",
    relatedIssueId: "relatedIssueId",
    type:           "type",
    companyId:      "companyId",
    createdByUserId: "createdByUserId",
  },
  issues: {
    id:              "id",
    companyId:       "companyId",
    status:          "status",
    title:           "title",
    assigneeAgentId: "assigneeAgentId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq:         (...a: any[]) => ({ op: "eq",         a }),
  and:        (...a: any[]) => ({ op: "and",        a }),
  inArray:    (...a: any[]) => ({ op: "inArray",    a }),
  notInArray: (...a: any[]) => ({ op: "notInArray", a }),
}));

vi.mock("../queue/emit.js", () => ({
  emit: { heartbeat: vi.fn().mockResolvedValue(undefined) },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_A     = "11111111-1111-4111-8111-111111111111"; // blocker
const TASK_B     = "22222222-2222-4222-8222-222222222222"; // downstream
const TASK_C     = "33333333-3333-4333-8333-333333333333"; // second blocker
const AGENT_ID   = "agent-001";
const USER_ID    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// ── DB mock factory ───────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const c: any = {};
  for (const m of ["from", "where", "orderBy"]) c[m] = vi.fn().mockReturnValue(c);
  c.then = (res: any, rej: any) => Promise.resolve(rows).then(res, rej);
  return c;
}

// ── releaseBlockedTasks ───────────────────────────────────────────────────────

describe("G8 — releaseBlockedTasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("1. releases single-blocker task when approved", async () => {
    const { emit } = await import("../queue/emit.js");
    let selectCount = 0;
    const db: any = {
      select: vi.fn(() => {
        selectCount++;
        if (selectCount === 1) return makeSelectChain([{ relatedIssueId: TASK_B }]); // downstream of A
        if (selectCount === 2) return makeSelectChain([{ issueId: TASK_A }]);         // blockers of B → only A
        return makeSelectChain([]);
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: TASK_B, assigneeAgentId: AGENT_ID }]),
          }),
        }),
      }),
    };

    const { releaseBlockedTasks } = await import("../tasks/dag.js");
    const released = await releaseBlockedTasks(db, TASK_A, COMPANY_ID);
    expect(released).toContain(TASK_B);
    expect(emit.heartbeat).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: AGENT_ID, triggeredBy: "dag_release" }),
      0,
    );
  });

  it("2. does NOT release when another blocker is still pending", async () => {
    let sc = 0;
    const db: any = {
      select: vi.fn(() => {
        sc++;
        if (sc === 1) return makeSelectChain([{ relatedIssueId: TASK_B }]);
        if (sc === 2) return makeSelectChain([{ issueId: TASK_A }, { issueId: TASK_C }]);
        if (sc === 3) return makeSelectChain([{ id: TASK_C }]); // TASK_C still pending
        return makeSelectChain([]);
      }),
      update: vi.fn(),
    };

    const { releaseBlockedTasks } = await import("../tasks/dag.js");
    const released = await releaseBlockedTasks(db, TASK_A, COMPANY_ID);
    expect(released).toHaveLength(0);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("3. releases task when all blockers resolved", async () => {
    let sc = 0;
    const db: any = {
      select: vi.fn(() => {
        sc++;
        if (sc === 1) return makeSelectChain([{ relatedIssueId: TASK_B }]);
        if (sc === 2) return makeSelectChain([{ issueId: TASK_A }, { issueId: TASK_C }]);
        if (sc === 3) return makeSelectChain([]); // TASK_C already resolved
        return makeSelectChain([]);
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: TASK_B, assigneeAgentId: null }]),
          }),
        }),
      }),
    };

    const { releaseBlockedTasks } = await import("../tasks/dag.js");
    const released = await releaseBlockedTasks(db, TASK_A, COMPANY_ID);
    expect(released).toContain(TASK_B);
  });

  it("4. returns [] when no downstream tasks", async () => {
    const db: any = { select: vi.fn(() => makeSelectChain([])) };
    const { releaseBlockedTasks } = await import("../tasks/dag.js");
    const released = await releaseBlockedTasks(db, TASK_A, COMPANY_ID);
    expect(released).toHaveLength(0);
  });

  it("5. emits heartbeat for released task agent", async () => {
    const { emit } = await import("../queue/emit.js");
    let sc = 0;
    const db: any = {
      select: vi.fn(() => {
        sc++;
        if (sc === 1) return makeSelectChain([{ relatedIssueId: TASK_B }]);
        if (sc === 2) return makeSelectChain([{ issueId: TASK_A }]);
        return makeSelectChain([]);
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: TASK_B, assigneeAgentId: AGENT_ID }]),
          }),
        }),
      }),
    };

    const { releaseBlockedTasks } = await import("../tasks/dag.js");
    await releaseBlockedTasks(db, TASK_A, COMPANY_ID);
    expect(emit.heartbeat).toHaveBeenCalled();
  });

  it("6. skips task not in blocked status (update returns empty)", async () => {
    let sc = 0;
    const db: any = {
      select: vi.fn(() => {
        sc++;
        if (sc === 1) return makeSelectChain([{ relatedIssueId: TASK_B }]);
        if (sc === 2) return makeSelectChain([{ issueId: TASK_A }]);
        return makeSelectChain([]);
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]), // task already done/cancelled
          }),
        }),
      }),
    };

    const { releaseBlockedTasks } = await import("../tasks/dag.js");
    const released = await releaseBlockedTasks(db, TASK_A, COMPANY_ID);
    expect(released).toHaveLength(0);
  });
});

// ── addDependency / removeDependency / getDagView ─────────────────────────────

describe("G8 — addDependency / removeDependency / getDagView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("7. addDependency sets downstream task to blocked", async () => {
    const db: any = {
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }),
    };
    const { addDependency } = await import("../tasks/dag.js");
    await addDependency(db, TASK_A, TASK_B, COMPANY_ID);
    expect(db.update).toHaveBeenCalled();
  });

  it("8. addDependency inserts issue_relation record", async () => {
    const valuesMock = vi.fn().mockResolvedValue([]);
    const db: any = {
      insert: vi.fn().mockReturnValue({ values: valuesMock }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }),
    };
    const { addDependency } = await import("../tasks/dag.js");
    await addDependency(db, TASK_A, TASK_B, COMPANY_ID, USER_ID);
    expect(db.insert).toHaveBeenCalled();
    const insertedValues = valuesMock.mock.calls[0][0];
    expect(insertedValues.type).toBe("blocks");
    expect(insertedValues.issueId).toBe(TASK_A);
    expect(insertedValues.relatedIssueId).toBe(TASK_B);
  });

  it("9. removeDependency auto-releases task when last blocker removed", async () => {
    const db: any = {
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({ rowCount: 1 }) }),
      select: vi.fn(() => makeSelectChain([])), // no remaining blockers
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }),
    };
    const { removeDependency } = await import("../tasks/dag.js");
    await removeDependency(db, TASK_A, TASK_B, COMPANY_ID);
    expect(db.update).toHaveBeenCalled();
  });

  it("10. removeDependency does NOT release when other blockers remain", async () => {
    const db: any = {
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({ rowCount: 1 }) }),
      select: vi.fn(() => makeSelectChain([{ issueId: TASK_C }])),
      update: vi.fn(),
    };
    const { removeDependency } = await import("../tasks/dag.js");
    await removeDependency(db, TASK_A, TASK_B, COMPANY_ID);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("11. getDagView returns upstream and downstream lists", async () => {
    let sc = 0;
    const db: any = {
      select: vi.fn(() => {
        sc++;
        if (sc === 1) return makeSelectChain([{ issueId: TASK_C }]);             // upstream of A
        if (sc === 2) return makeSelectChain([{ relatedIssueId: TASK_B }]);      // downstream of A
        return makeSelectChain([]);
      }),
    };

    // Patch Promise.all to intercept the inArray selects for task details
    const origAll = Promise.all.bind(Promise);
    const allSpy = vi
      .spyOn(Promise, "all")
      .mockImplementationOnce(() =>
        origAll([
          Promise.resolve([{ id: TASK_C, title: "C", status: "done" }]),
          Promise.resolve([{ id: TASK_B, title: "B", status: "blocked" }]),
        ]),
      );

    const { getDagView } = await import("../tasks/dag.js");
    const dag = await getDagView(db, TASK_A, COMPANY_ID);
    allSpy.mockRestore();

    expect(dag.upstream).toHaveLength(1);
    expect(dag.downstream).toHaveLength(1);
    expect(dag.upstream[0].id).toBe(TASK_C);
    expect(dag.downstream[0].id).toBe(TASK_B);
  });
});
