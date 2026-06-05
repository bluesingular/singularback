/**
 * C2 — Agent collision detection
 * C3 — Task cancellation (checkCancellation)
 * C4 — Per-company queue concurrency limit
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkContactCollision, recordExternalCommunication } from "../safety/collision.js";
import { checkCancellation, TaskCancelledException } from "../tasks/checkpoints.js";
import { enforceCompanyConcurrency, CompanyConcurrencyLimitError } from "../safety/concurrency.js";
import { executeAction, ContactCollisionError } from "../extensions/builtin-actions.js";

// runGates is wired into executeAction (RULE 3). Mock it so C2 tests stay
// focused on collision logic rather than needing a full quality-gates DB setup.
vi.mock("../gates/engine.js", () => ({
  runGates: vi.fn().mockResolvedValue({ passed: true }),
}));

// ── Shared mock DB factory ────────────────────────────────────────────────────

function makeDb(overrides: Record<string, any> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    ...overrides,
  } as any;
}

// ── C2: checkContactCollision ─────────────────────────────────────────────────

describe("C2 — checkContactCollision", () => {
  it("returns collision:false when no recent communication exists", async () => {
    const db = makeDb({ limit: vi.fn().mockResolvedValue([]) });
    const result = await checkContactCollision(db, "company-1", "contact-1");
    expect(result.collision).toBe(false);
  });

  it("returns collision:true when recent communication exists", async () => {
    const recentDate = new Date();
    const db = makeDb({
      limit: vi.fn().mockResolvedValue([{ createdAt: recentDate, taskId: "task-42" }]),
    });
    const result = await checkContactCollision(db, "company-1", "contact-1");
    expect(result.collision).toBe(true);
    expect(result.lastContact).toBe(recentDate);
    expect(result.taskId).toBe("task-42");
  });

  it("respects custom cooldown hours", async () => {
    const db = makeDb({ limit: vi.fn().mockResolvedValue([]) });
    // Just verifies it doesn't throw with a custom cooldown
    const result = await checkContactCollision(db, "c1", "contact-1", 48);
    expect(result.collision).toBe(false);
  });
});

// ── C2: executeAction collision guard ─────────────────────────────────────────

describe("C2 — executeAction collision guard", () => {
  it("throws ContactCollisionError when contact was recently reached", async () => {
    const recentDate = new Date();
    const db = makeDb({
      limit: vi.fn().mockResolvedValue([{ createdAt: recentDate, taskId: "old-task" }]),
    });

    await expect(
      executeAction(
        db,
        "send_email",
        { to: "test@example.com", subject: "Hi", body: "Hello" },
        { companyId: "company-1", agentId: "agent-1", taskId: "task-1", traceId: "trace-1" },
        "contact-1",
      ),
    ).rejects.toThrow(ContactCollisionError);
  });

  it("proceeds without collision check for non-external actions", async () => {
    const db = makeDb({ limit: vi.fn().mockResolvedValue([]) });

    const result = await executeAction(
      db,
      "create_document",
      { title: "Rapport", content: "..." },
      { companyId: "company-1", agentId: "agent-1", taskId: "task-1", traceId: "trace-1" },
      // no contactId — non-external action
    );
    expect(result).toContain("Rapport");
  });

  it("throws ActionTypeUnknownError for unknown slug", async () => {
    const db = makeDb();
    const { ActionTypeUnknownError } = await import("../extensions/builtin-actions.js");
    await expect(
      executeAction(db, "nonexistent_action", {}, {
        companyId: "c1", agentId: "a1", taskId: "t1", traceId: "tr1",
      }),
    ).rejects.toThrow(ActionTypeUnknownError);
  });
});

// ── C3: checkCancellation ─────────────────────────────────────────────────────

describe("C3 — checkCancellation", () => {
  it("does not throw when cancelRequested is false", async () => {
    const db = makeDb({
      limit: vi.fn().mockResolvedValue([{ cancelRequested: false }]),
    });
    await expect(checkCancellation(db, "task-1", "company-1")).resolves.not.toThrow();
  });

  it("throws TaskCancelledException when cancelRequested is true", async () => {
    const db = makeDb({
      limit: vi.fn().mockResolvedValue([{ cancelRequested: true }]),
    });
    await expect(checkCancellation(db, "task-1", "company-1"))
      .rejects.toThrow(TaskCancelledException);
  });

  it("does not throw when task is not found (defensive — task may have been cleaned up)", async () => {
    const db = makeDb({ limit: vi.fn().mockResolvedValue([]) });
    await expect(checkCancellation(db, "unknown-task", "company-1")).resolves.not.toThrow();
  });

  it("TaskCancelledException has correct name and taskId", async () => {
    const db = makeDb({
      limit: vi.fn().mockResolvedValue([{ cancelRequested: true }]),
    });
    try {
      await checkCancellation(db, "task-99", "company-1");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.name).toBe("TaskCancelledException");
      expect(err.taskId).toBe("task-99");
    }
  });
});

// ── C4: enforceCompanyConcurrency ─────────────────────────────────────────────

// The concurrency function issues two independent db.select() chains:
//   1. select({maxConcurrentTasks}).from(companies).where(...).limit(1) → array
//   2. select({active:count()}).from(issues).where(...) → array (no .limit)
// Each call to db.select() returns a fresh chain with the right terminal value.
function makeConcurrencyDb(maxConcurrentTasks: number | null, activeCount: number) {
  let selectCall = 0;
  return {
    select: vi.fn().mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        // Company lookup — has .limit(1)
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(
            maxConcurrentTasks !== null ? [{ maxConcurrentTasks }] : [],
          ),
        };
      }
      // Count query — no .limit, resolves at .where()
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ active: activeCount }]),
      };
    }),
  } as any;
}

describe("C4 — enforceCompanyConcurrency", () => {
  it("does not throw when active tasks are below limit", async () => {
    const db = makeConcurrencyDb(5, 3);
    await expect(enforceCompanyConcurrency(db, "company-1")).resolves.not.toThrow();
  });

  it("throws CompanyConcurrencyLimitError when at limit", async () => {
    const db = makeConcurrencyDb(5, 5);
    await expect(enforceCompanyConcurrency(db, "company-1"))
      .rejects.toThrow(CompanyConcurrencyLimitError);
  });

  it("throws when active tasks exceed limit", async () => {
    const db = makeConcurrencyDb(2, 3);
    await expect(enforceCompanyConcurrency(db, "company-1"))
      .rejects.toThrow(CompanyConcurrencyLimitError);
  });

  it("uses default limit of 5 when company has no maxConcurrentTasks", async () => {
    const db = makeConcurrencyDb(null, 3); // no company row → default 5
    await expect(enforceCompanyConcurrency(db, "company-1")).resolves.not.toThrow();
  });

  it("CompanyConcurrencyLimitError has correct companyId, limit, and active", async () => {
    const db = makeConcurrencyDb(5, 5);
    try {
      await enforceCompanyConcurrency(db, "company-42");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.name).toBe("CompanyConcurrencyLimitError");
      expect(err.companyId).toBe("company-42");
      expect(err.limit).toBe(5);
      expect(err.active).toBe(5);
    }
  });
});
