/**
 * Agent-to-agent handoff service
 *
 * Tests:
 *  1.  evaluateHandoffs: rating ≥ 4, cv_score_gte_4 condition → creates follow-on task
 *  2.  evaluateHandoffs: rating < 4, cv_score_gte_4 condition → no handoff
 *  3.  evaluateHandoffs: agent has no handoffs → no handoff
 *  4.  evaluateHandoffs: target agent not found → skips gracefully (no crash)
 *  5.  evaluateHandoffs: rating = 4 (boundary) → triggers
 *  6.  evaluateHandoffs: rating = 3 (boundary) → no trigger
 *  7.  evaluateHandoffs: template variable interpolation in task title
 *  8.  evaluateHandoffs: unknown condition → no trigger (future-proof)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { evaluateHandoffs } from "../handoff/service.js";

// ── DB mock ───────────────────────────────────────────────────────────────────

function makeHandoffDb({
  agentMeta,
  targetAgentId = "target-agent-id",
  insertedIssueId = "new-issue-id",
}: {
  agentMeta: Record<string, unknown>;
  targetAgentId?: string | null;
  insertedIssueId?: string;
}) {
  const returningInsert = vi.fn().mockResolvedValue([{ id: insertedIssueId }]);
  const valuesInsert    = vi.fn().mockReturnValue({ returning: returningInsert });
  const insertFn        = vi.fn().mockReturnValue({ values: valuesInsert });

  // select().from().where().limit() → returns agent row or target agent row
  let selectCallIndex = 0;
  const limitFn = vi.fn().mockImplementation(() => {
    const call = selectCallIndex++;
    // call 0 → source agent; call 1 → target agent
    if (call === 0) {
      return Promise.resolve([{ id: "source-agent-id", metadata: agentMeta }]);
    }
    return Promise.resolve(targetAgentId ? [{ id: targetAgentId }] : []);
  });
  const whereFn  = vi.fn().mockReturnValue({ limit: limitFn });
  const fromFn   = vi.fn().mockReturnValue({ where: whereFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  return {
    db: { select: selectFn, insert: insertFn } as any,
    mocks: { insertFn, valuesInsert, returningInsert },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("evaluateHandoffs", () => {
  const BASE_CTX = {
    companyId: "co-1",
    issueId:   "issue-1",
    agentId:   "agent-1",
    rating:    5,
  };

  const CV_HANDOFF_META = {
    handoffs: [
      {
        condition:    "cv_score_gte_4",
        targetAgent:  "marc-client",
        taskTemplate: "Présenter {{candidate_name}} pour {{client_name}}",
      },
    ],
  };

  it("rating ≥ 4 with cv_score_gte_4 → creates follow-on task", async () => {
    const { db, mocks } = makeHandoffDb({ agentMeta: CV_HANDOFF_META });
    const result = await evaluateHandoffs(db, { ...BASE_CTX, rating: 5 });

    expect(result.triggered).toBe(true);
    expect(result.handoffCount).toBe(1);
    expect(result.issueIds).toHaveLength(1);
    expect(mocks.insertFn).toHaveBeenCalledOnce();
  });

  it("rating < 4 with cv_score_gte_4 → no handoff", async () => {
    const { db, mocks } = makeHandoffDb({ agentMeta: CV_HANDOFF_META });
    const result = await evaluateHandoffs(db, { ...BASE_CTX, rating: 3 });

    expect(result.triggered).toBe(false);
    expect(result.handoffCount).toBe(0);
    expect(mocks.insertFn).not.toHaveBeenCalled();
  });

  it("agent has no handoffs → returns not triggered", async () => {
    const { db, mocks } = makeHandoffDb({ agentMeta: { skillsAssigned: ["qualification-cv"] } });
    const result = await evaluateHandoffs(db, { ...BASE_CTX, rating: 5 });

    expect(result.triggered).toBe(false);
    expect(mocks.insertFn).not.toHaveBeenCalled();
  });

  it("target agent not found → skips gracefully", async () => {
    const { db, mocks } = makeHandoffDb({
      agentMeta:     CV_HANDOFF_META,
      targetAgentId: null,
    });
    const result = await evaluateHandoffs(db, { ...BASE_CTX, rating: 5 });

    expect(result.triggered).toBe(false);
    expect(result.handoffCount).toBe(0);
    expect(mocks.insertFn).not.toHaveBeenCalled();
  });

  it("rating = 4 (boundary) → triggers", async () => {
    const { db } = makeHandoffDb({ agentMeta: CV_HANDOFF_META });
    const result = await evaluateHandoffs(db, { ...BASE_CTX, rating: 4 });
    expect(result.triggered).toBe(true);
  });

  it("rating = 3 (boundary) → no trigger", async () => {
    const { db } = makeHandoffDb({ agentMeta: CV_HANDOFF_META });
    const result = await evaluateHandoffs(db, { ...BASE_CTX, rating: 3 });
    expect(result.triggered).toBe(false);
  });

  it("template variables are interpolated into the task title", async () => {
    const { db, mocks } = makeHandoffDb({ agentMeta: CV_HANDOFF_META });
    await evaluateHandoffs(db, {
      ...BASE_CTX,
      rating:    5,
      variables: { candidate_name: "Thomas Lefebvre", client_name: "Innotec" },
    });

    const inserted = mocks.valuesInsert.mock.calls[0][0] as { title: string };
    expect(inserted.title).toBe("Présenter Thomas Lefebvre pour Innotec");
  });

  it("unknown condition → no trigger (future-proof)", async () => {
    const { db, mocks } = makeHandoffDb({
      agentMeta: {
        handoffs: [{ condition: "unknown_future_condition", targetAgent: "marc-client", taskTemplate: "Do X" }],
      },
    });
    const result = await evaluateHandoffs(db, { ...BASE_CTX, rating: 5 });

    expect(result.triggered).toBe(false);
    expect(mocks.insertFn).not.toHaveBeenCalled();
  });
});
