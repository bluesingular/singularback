/**
 * C1 — Task state machine tests
 *
 * Verifies that the DB-level trigger enforce_task_state_transition()
 * blocks invalid task status transitions and allows valid ones.
 *
 * Transition table derived from auditing every db.update(issues).set({ status })
 * call in the server codebase. Key invariants:
 *   - ANY non-terminal state can transition to blocked (dag.ts addDependency)
 *   - ANY non-terminal state can transition to cancelled (a2a/server.ts cancel)
 *   - backlog cannot skip directly to done/failed/completed states
 *   - done/cancelled can reopen to todo (human workflow in issues.ts)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDb, companies, issues } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeWithDb = embeddedPostgresSupport.supported ? describe : describe.skip;

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEST_COMPANY_ID = "00000000-0000-0000-0000-000000000001";
type Db = ReturnType<typeof createDb>;

async function createTask(db: Db, status: string): Promise<string> {
  const [row] = await db
    .insert(issues)
    .values({ companyId: TEST_COMPANY_ID, title: `C1 [${status}]`, status, originKind: "manual" })
    .returning({ id: issues.id });
  return row.id;
}

async function setStatus(db: Db, id: string, status: string): Promise<void> {
  await db.update(issues).set({ status }).where(eq(issues.id, id));
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describeWithDb("C1 task state machine", () => {
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  let db: Db;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("c1-task-state-machine-");
    db = createDb(tempDb.connectionString);
    await db.insert(companies).values({
      id: TEST_COMPANY_ID, name: "C1 Test Co", slug: "c1-test-co", memberCount: 1,
    }).onConflictDoNothing();
  });

  afterAll(async () => { await tempDb?.cleanup(); });

  // ── No-op (same status) ────────────────────────────────────────────────────

  it("allows same-status update (no-op)", async () => {
    const id = await createTask(db, "in_progress");
    await expect(setStatus(db, id, "in_progress")).resolves.not.toThrow();
  });

  // ── Core execution path ────────────────────────────────────────────────────

  it("allows backlog → todo", async () => {
    const id = await createTask(db, "backlog");
    await expect(setStatus(db, id, "todo")).resolves.not.toThrow();
  });

  it("allows todo → in_progress", async () => {
    const id = await createTask(db, "todo");
    await expect(setStatus(db, id, "in_progress")).resolves.not.toThrow();
  });

  it("allows in_progress → in_review (approval gate)", async () => {
    const id = await createTask(db, "in_progress");
    await expect(setStatus(db, id, "in_review")).resolves.not.toThrow();
  });

  it("allows in_progress → pending_approval", async () => {
    const id = await createTask(db, "in_progress");
    await expect(setStatus(db, id, "pending_approval")).resolves.not.toThrow();
  });

  it("allows in_review → done (approved)", async () => {
    const id = await createTask(db, "in_review");
    await expect(setStatus(db, id, "done")).resolves.not.toThrow();
  });

  it("allows pending_approval → done (approved)", async () => {
    const id = await createTask(db, "pending_approval");
    await expect(setStatus(db, id, "done")).resolves.not.toThrow();
  });

  it("allows in_progress → done (autonomous completion)", async () => {
    const id = await createTask(db, "in_progress");
    await expect(setStatus(db, id, "done")).resolves.not.toThrow();
  });

  it("allows in_progress → failed", async () => {
    const id = await createTask(db, "in_progress");
    await expect(setStatus(db, id, "failed")).resolves.not.toThrow();
  });

  it("allows failed → todo (retry)", async () => {
    const id = await createTask(db, "failed");
    await expect(setStatus(db, id, "todo")).resolves.not.toThrow();
  });

  // ── Clarification flow ─────────────────────────────────────────────────────

  it("allows in_progress → awaiting_clarification", async () => {
    const id = await createTask(db, "in_progress");
    await expect(setStatus(db, id, "awaiting_clarification")).resolves.not.toThrow();
  });

  it("allows awaiting_clarification → in_progress (answer received)", async () => {
    const id = await createTask(db, "awaiting_clarification");
    await expect(setStatus(db, id, "in_progress")).resolves.not.toThrow();
  });

  it("allows awaiting_clarification → blocked (timeout / admin decline)", async () => {
    const id = await createTask(db, "awaiting_clarification");
    await expect(setStatus(db, id, "blocked")).resolves.not.toThrow();
  });

  it("allows awaiting_clarification → cancelled", async () => {
    const id = await createTask(db, "awaiting_clarification");
    await expect(setStatus(db, id, "cancelled")).resolves.not.toThrow();
  });

  // ── DAG: any non-terminal → blocked ───────────────────────────────────────

  it("allows backlog → blocked (DAG dependency added)", async () => {
    const id = await createTask(db, "backlog");
    await expect(setStatus(db, id, "blocked")).resolves.not.toThrow();
  });

  it("allows todo → blocked", async () => {
    const id = await createTask(db, "todo");
    await expect(setStatus(db, id, "blocked")).resolves.not.toThrow();
  });

  it("allows in_progress → blocked", async () => {
    const id = await createTask(db, "in_progress");
    await expect(setStatus(db, id, "blocked")).resolves.not.toThrow();
  });

  it("allows in_review → blocked (DAG blocks a task in review)", async () => {
    const id = await createTask(db, "in_review");
    await expect(setStatus(db, id, "blocked")).resolves.not.toThrow();
  });

  it("allows pending_approval → blocked", async () => {
    const id = await createTask(db, "pending_approval");
    await expect(setStatus(db, id, "blocked")).resolves.not.toThrow();
  });

  it("allows failed → blocked", async () => {
    const id = await createTask(db, "failed");
    await expect(setStatus(db, id, "blocked")).resolves.not.toThrow();
  });

  it("allows blocked → todo (DAG releases task when blockers resolve)", async () => {
    const id = await createTask(db, "blocked");
    await expect(setStatus(db, id, "todo")).resolves.not.toThrow();
  });

  // ── Partial completion flow ────────────────────────────────────────────────

  it("allows in_progress → partial_complete", async () => {
    const id = await createTask(db, "in_progress");
    await expect(setStatus(db, id, "partial_complete")).resolves.not.toThrow();
  });

  it("allows partial_complete → done (operator approves partial)", async () => {
    const id = await createTask(db, "partial_complete");
    await expect(setStatus(db, id, "done")).resolves.not.toThrow();
  });

  it("allows partial_complete → in_progress (retry failed items)", async () => {
    const id = await createTask(db, "partial_complete");
    await expect(setStatus(db, id, "in_progress")).resolves.not.toThrow();
  });

  // ── Cancellation: any non-terminal → cancelled ────────────────────────────

  it("allows in_review → cancelled", async () => {
    const id = await createTask(db, "in_review");
    await expect(setStatus(db, id, "cancelled")).resolves.not.toThrow();
  });

  it("allows pending_approval → cancelled", async () => {
    const id = await createTask(db, "pending_approval");
    await expect(setStatus(db, id, "cancelled")).resolves.not.toThrow();
  });

  it("allows blocked → cancelled", async () => {
    const id = await createTask(db, "blocked");
    await expect(setStatus(db, id, "cancelled")).resolves.not.toThrow();
  });

  // ── Reopen ─────────────────────────────────────────────────────────────────

  it("allows done → todo (reopen)", async () => {
    const id = await createTask(db, "done");
    await expect(setStatus(db, id, "todo")).resolves.not.toThrow();
  });

  it("allows cancelled → todo (reopen)", async () => {
    const id = await createTask(db, "cancelled");
    await expect(setStatus(db, id, "todo")).resolves.not.toThrow();
  });

  // ── INVALID transitions — trigger must throw ───────────────────────────────

  it("rejects backlog → done (skips execution entirely)", async () => {
    const id = await createTask(db, "backlog");
    await expect(setStatus(db, id, "done"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  it("rejects backlog → failed (never ran)", async () => {
    const id = await createTask(db, "backlog");
    await expect(setStatus(db, id, "failed"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  it("rejects done → in_progress (cannot re-run a completed task)", async () => {
    const id = await createTask(db, "done");
    await expect(setStatus(db, id, "in_progress"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  it("rejects done → failed (already done)", async () => {
    const id = await createTask(db, "done");
    await expect(setStatus(db, id, "failed"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  it("rejects cancelled → in_progress (must reopen via todo first)", async () => {
    const id = await createTask(db, "cancelled");
    await expect(setStatus(db, id, "in_progress"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  it("rejects cancelled → done", async () => {
    const id = await createTask(db, "cancelled");
    await expect(setStatus(db, id, "done"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  it("rejects in_review → pending_approval (already in approval flow)", async () => {
    const id = await createTask(db, "in_review");
    await expect(setStatus(db, id, "pending_approval"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  it("rejects awaiting_clarification → done (must pass through in_progress first)", async () => {
    const id = await createTask(db, "awaiting_clarification");
    await expect(setStatus(db, id, "done"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  it("rejects failed → done (must retry via todo first)", async () => {
    const id = await createTask(db, "failed");
    await expect(setStatus(db, id, "done"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  it("rejects failed → pending_approval (must retry via todo first)", async () => {
    const id = await createTask(db, "failed");
    await expect(setStatus(db, id, "pending_approval"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  it("rejects blocked → done (blocked tasks cannot complete without running)", async () => {
    const id = await createTask(db, "blocked");
    await expect(setStatus(db, id, "done"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  it("rejects blocked → failed (blocked tasks cannot fail without running)", async () => {
    const id = await createTask(db, "blocked");
    await expect(setStatus(db, id, "failed"))
      .rejects.toThrow(/Invalid task state transition/);
  });

  // ── Error message quality ──────────────────────────────────────────────────

  it("error message includes both old and new status values", async () => {
    const id = await createTask(db, "done");
    try {
      await setStatus(db, id, "in_progress");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.message).toContain("done");
      expect(err.message).toContain("in_progress");
    }
  });
});
