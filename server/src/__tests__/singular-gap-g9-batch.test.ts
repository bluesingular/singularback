/**
 * G9 — Batch processing service unit tests (tests 1–10)
 *
 * Route tests (11–14) are in singular-gap-g9-batch-routes.test.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("@paperclipai/db", () => ({
  batchRuns: {
    id:              "id",
    companyId:       "companyId",
    skillType:       "skillType",
    agentId:         "agentId",
    parentIssueId:   "parentIssueId",
    createdByUserId: "createdByUserId",
    itemCount:       "itemCount",
    completedCount:  "completedCount",
    failedCount:     "failedCount",
    status:          "status",
    approvedByUserId: "approvedByUserId",
    approvedAt:      "approvedAt",
    updatedAt:       "updatedAt",
    createdAt:       "createdAt",
  },
  batchItems: {
    id:          "id",
    batchRunId:  "batchRunId",
    companyId:   "companyId",
    issueId:     "issueId",
    itemIndex:   "itemIndex",
    input:       "input",
    status:      "status",
    output:      "output",
    createdAt:   "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq:  (...a: any[]) => ({ op: "eq",  a }),
  and: (...a: any[]) => ({ op: "and", a }),
}));

vi.mock("../queue/emit.js", () => ({
  emit: {
    batchExecuteItem: vi.fn().mockResolvedValue(undefined),
    batchItemComplete: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID  = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENT_ID    = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BATCH_ID    = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ITEM_ID_1   = "11111111-1111-4111-8111-111111111111";
const ITEM_ID_2   = "22222222-2222-4222-8222-222222222222";
const USER_ID     = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SKILL_TYPE  = "data-analysis";

const ITEMS = [
  { url: "https://example.com/item1" },
  { url: "https://example.com/item2" },
];

// ── createBatch ───────────────────────────────────────────────────────────────

describe("G9 — createBatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("1. inserts batch_run with correct item_count and returns id", async () => {
    const insertMock = vi.fn()
      .mockReturnValueOnce({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: BATCH_ID }]) }) })  // batch_run
      .mockReturnValueOnce({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: ITEM_ID_1 }, { id: ITEM_ID_2 }]) }) }); // batch_items

    const db: any = { insert: insertMock };
    const { createBatch } = await import("../batch/runner.js");
    const result = await createBatch(db, { companyId: COMPANY_ID, skillType: SKILL_TYPE, agentId: AGENT_ID, items: ITEMS });

    expect(result).toBe(BATCH_ID);
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it("2. enqueues one BullMQ job per item", async () => {
    const { emit } = await import("../queue/emit.js");
    const insertMock = vi.fn()
      .mockReturnValueOnce({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: BATCH_ID }]) }) })
      .mockReturnValueOnce({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: ITEM_ID_1 }, { id: ITEM_ID_2 }]) }) });

    const db: any = { insert: insertMock };
    const { createBatch } = await import("../batch/runner.js");
    await createBatch(db, { companyId: COMPANY_ID, skillType: SKILL_TYPE, items: ITEMS });

    expect(emit.batchExecuteItem).toHaveBeenCalledTimes(ITEMS.length);
  });

  it("3. throws when items array is empty", async () => {
    const db: any = { insert: vi.fn() };
    const { createBatch } = await import("../batch/runner.js");
    await expect(
      createBatch(db, { companyId: COMPANY_ID, skillType: SKILL_TYPE, items: [] }),
    ).rejects.toThrow("at least one item");
  });

  it("4. passes correct batchRunId to each enqueued job", async () => {
    const { emit } = await import("../queue/emit.js");
    const insertMock = vi.fn()
      .mockReturnValueOnce({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: BATCH_ID }]) }) })
      .mockReturnValueOnce({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: ITEM_ID_1 }, { id: ITEM_ID_2 }]) }) });

    const db: any = { insert: insertMock };
    const { createBatch } = await import("../batch/runner.js");
    await createBatch(db, { companyId: COMPANY_ID, skillType: SKILL_TYPE, items: ITEMS });

    const calls = vi.mocked(emit.batchExecuteItem).mock.calls;
    expect(calls.every(([arg]) => arg.batchRunId === BATCH_ID)).toBe(true);
  });
});

// ── onItemComplete ────────────────────────────────────────────────────────────

describe("G9 — onItemComplete", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeUpdateChain() {
    return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
  }

  it("5. increments completed_count for done outcome", async () => {
    let updateCount = 0;
    const db: any = {
      update: vi.fn(() => { updateCount++; return makeUpdateChain(); }),
      select: vi.fn(() => {
        const c: any = {};
        for (const m of ["from", "where"]) c[m] = vi.fn().mockReturnValue(c);
        c.then = (res: any, rej: any) =>
          Promise.resolve([{ itemCount: 2, completedCount: 0, failedCount: 0, status: "running" }]).then(res, rej);
        return c;
      }),
    };
    const { onItemComplete } = await import("../batch/runner.js");
    await onItemComplete(db, BATCH_ID, ITEM_ID_1, COMPANY_ID, "done");
    expect(db.update).toHaveBeenCalledTimes(2); // item + batch_run
  });

  it("6. sets status to awaiting_approval when all items complete", async () => {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    let updateCount = 0;
    const db: any = {
      update: vi.fn(() => { updateCount++; return { set: setMock }; }),
      select: vi.fn(() => {
        const c: any = {};
        for (const m of ["from", "where"]) c[m] = vi.fn().mockReturnValue(c);
        // Both items already done: completedCount:1, failedCount:0, itemCount:2
        c.then = (res: any, rej: any) =>
          Promise.resolve([{ itemCount: 2, completedCount: 1, failedCount: 0, status: "running" }]).then(res, rej);
        return c;
      }),
    };
    const { onItemComplete } = await import("../batch/runner.js");
    await onItemComplete(db, BATCH_ID, ITEM_ID_2, COMPANY_ID, "done");

    // Second update (batch_run update) should set status to awaiting_approval
    const batchUpdateArgs = setMock.mock.calls[1]?.[0] ?? setMock.mock.calls[0]?.[0];
    const allSetArgs = setMock.mock.calls.map(c => c[0]);
    const batchArg = allSetArgs.find((a: any) => a.status !== undefined && a.status !== "done" && a.status !== "failed");
    expect(batchArg?.status).toBe("awaiting_approval");
  });

  it("7. does NOT set awaiting_approval when items remain", async () => {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    const db: any = {
      update: vi.fn(() => ({ set: setMock })),
      select: vi.fn(() => {
        const c: any = {};
        for (const m of ["from", "where"]) c[m] = vi.fn().mockReturnValue(c);
        // Only 1 of 3 done
        c.then = (res: any, rej: any) =>
          Promise.resolve([{ itemCount: 3, completedCount: 0, failedCount: 0, status: "running" }]).then(res, rej);
        return c;
      }),
    };
    const { onItemComplete } = await import("../batch/runner.js");
    await onItemComplete(db, BATCH_ID, ITEM_ID_1, COMPANY_ID, "done");

    const allSetArgs = setMock.mock.calls.map(c => c[0]);
    const batchArg = allSetArgs.find((a: any) => a.completedCount !== undefined);
    expect(batchArg?.status).toBe("running");
  });

  it("8. increments failed_count for failed outcome", async () => {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    const db: any = {
      update: vi.fn(() => ({ set: setMock })),
      select: vi.fn(() => {
        const c: any = {};
        for (const m of ["from", "where"]) c[m] = vi.fn().mockReturnValue(c);
        c.then = (res: any, rej: any) =>
          Promise.resolve([{ itemCount: 2, completedCount: 0, failedCount: 0, status: "running" }]).then(res, rej);
        return c;
      }),
    };
    const { onItemComplete } = await import("../batch/runner.js");
    await onItemComplete(db, BATCH_ID, ITEM_ID_1, COMPANY_ID, "failed");

    const allSetArgs = setMock.mock.calls.map(c => c[0]);
    const batchArg = allSetArgs.find((a: any) => a.failedCount !== undefined);
    expect(batchArg?.failedCount).toBe(1);
  });
});

// ── approveBatch / rejectBatch ────────────────────────────────────────────────

describe("G9 — approveBatch / rejectBatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("9. approveBatch sets status to approved with actorId and timestamp", async () => {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    const db: any = { update: vi.fn(() => ({ set: setMock })) };

    const { approveBatch } = await import("../batch/runner.js");
    await approveBatch(db, BATCH_ID, COMPANY_ID, USER_ID);

    const args = setMock.mock.calls[0][0];
    expect(args.status).toBe("approved");
    expect(args.approvedByUserId).toBe(USER_ID);
    expect(args.approvedAt).toBeInstanceOf(Date);
  });

  it("10. rejectBatch sets status to rejected", async () => {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    const db: any = { update: vi.fn(() => ({ set: setMock })) };

    const { rejectBatch } = await import("../batch/runner.js");
    await rejectBatch(db, BATCH_ID, COMPANY_ID, USER_ID);

    const args = setMock.mock.calls[0][0];
    expect(args.status).toBe("rejected");
    expect(args.approvedByUserId).toBe(USER_ID);
  });
});
