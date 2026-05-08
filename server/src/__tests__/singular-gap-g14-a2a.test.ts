/**
 * G14 — A2A protocol: server unit tests (tests 1–10)
 *
 * Route tests (11–18) are in singular-gap-g14-a2a-routes.test.ts
 *
 * Tests:
 *  1.  issueStatusToA2AState — maps all issue statuses correctly
 *  2.  buildAgentCard — returns valid A2A agent card with company agents as skills
 *  3.  handleA2ARequest — tasks/send creates new issue, returns submitted state
 *  4.  handleA2ARequest — tasks/send updates existing issue (continue task)
 *  5.  handleA2ARequest — tasks/send rejects missing id
 *  6.  handleA2ARequest — tasks/send rejects empty message parts
 *  7.  handleA2ARequest — tasks/get returns task by id
 *  8.  handleA2ARequest — tasks/get returns TASK_NOT_FOUND for unknown id
 *  9.  handleA2ARequest — tasks/cancel sets status to cancelled
 * 10.  handleA2ARequest — tasks/cancel rejects TASK_NOT_CANCELABLE for done task
 */

import { describe, expect, it, vi } from "vitest";

describe("G14 — A2A server unit tests", () => {

  // ── 1. issueStatusToA2AState ──────────────────────────────────────────────

  it("1. issueStatusToA2AState — maps all issue statuses correctly", async () => {
    const { issueStatusToA2AState } = await import("../a2a/types.js");

    expect(issueStatusToA2AState("backlog")).toBe("submitted");
    expect(issueStatusToA2AState("todo")).toBe("submitted");
    expect(issueStatusToA2AState("open")).toBe("submitted");
    expect(issueStatusToA2AState("in_progress")).toBe("working");
    expect(issueStatusToA2AState("in_review")).toBe("working");
    expect(issueStatusToA2AState("blocked")).toBe("input-required");
    expect(issueStatusToA2AState("awaiting_approval")).toBe("input-required");
    expect(issueStatusToA2AState("done")).toBe("completed");
    expect(issueStatusToA2AState("cancelled")).toBe("canceled");
    expect(issueStatusToA2AState("unknown")).toBe("submitted"); // fallback
  });

  // ── 2. buildAgentCard ─────────────────────────────────────────────────────

  it("2. buildAgentCard — returns valid card with agents as skills", async () => {
    const { buildAgentCard } = await import("../a2a/server.js");
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([
        { id: "agent-1", name: "Sophie" },
        { id: "agent-2", name: "Marc" },
      ]),
    };
    const card = await buildAgentCard(db, "comp-1", "https://app.swwarm.com");

    expect(card.name).toBe("Swwarm AI Platform");
    expect(card.url).toBe("https://app.swwarm.com/a2a/comp-1");
    expect(card.capabilities.streaming).toBe(false);
    expect(card.capabilities.stateTransitionHistory).toBe(true);
    expect(card.authentication.schemes).toContain("Bearer");
    expect(card.skills).toHaveLength(2);
    expect(card.skills[0].id).toBe("agent-1");
    expect(card.skills[0].name).toBe("Sophie");
  });

  // ── 3–6. tasks/send ───────────────────────────────────────────────────────

  it("3. tasks/send — creates new issue, returns submitted state", async () => {
    const { handleA2ARequest } = await import("../a2a/server.js");
    const created = { id: "task-1", title: "Qualify this CV", description: "Qualify this CV", status: "todo", createdAt: new Date() };
    const mockReturning = vi.fn().mockResolvedValue([created]);
    const mockValues    = vi.fn().mockReturnValue({ returning: mockReturning });
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([]), // no existing task
      insert: vi.fn().mockReturnValue({ values: mockValues }),
    };

    const res = await handleA2ARequest(db, "comp-1", {
      jsonrpc: "2.0", id: 1, method: "tasks/send",
      params: {
        id: "task-1",
        message: { role: "user", parts: [{ type: "text", text: "Qualify this CV" }] },
      },
    });

    expect(res.error).toBeUndefined();
    expect((res.result as any).id).toBe("task-1");
    expect((res.result as any).status.state).toBe("submitted");
  });

  it("4. tasks/send — updates existing task (continue flow)", async () => {
    const { handleA2ARequest } = await import("../a2a/server.js");
    const existing = { id: "task-1", status: "in_progress" };
    const updated  = { id: "task-1", title: "Job posting", description: "Updated content", status: "in_progress", createdAt: new Date() };
    const mockReturning = vi.fn().mockResolvedValue([updated]);
    const mockWhere     = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet       = vi.fn().mockReturnValue({ where: mockWhere });
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([existing]),
      update: vi.fn().mockReturnValue({ set: mockSet }),
    };

    const res = await handleA2ARequest(db, "comp-1", {
      jsonrpc: "2.0", id: 2, method: "tasks/send",
      params: {
        id: "task-1",
        message: { role: "user", parts: [{ type: "text", text: "Updated content" }] },
      },
    });

    expect(res.error).toBeUndefined();
    expect((res.result as any).status.state).toBe("working");
  });

  it("5. tasks/send — returns INVALID_PARAMS for missing id", async () => {
    const { handleA2ARequest } = await import("../a2a/server.js");
    const db: any = {};
    const res = await handleA2ARequest(db, "comp-1", {
      jsonrpc: "2.0", id: 3, method: "tasks/send",
      params: {
        message: { role: "user", parts: [{ type: "text", text: "hello" }] },
      },
    });
    expect(res.error?.code).toBe(-32602);
  });

  it("6. tasks/send — returns INVALID_PARAMS for empty message parts", async () => {
    const { handleA2ARequest } = await import("../a2a/server.js");
    const db: any = {};
    const res = await handleA2ARequest(db, "comp-1", {
      jsonrpc: "2.0", id: 4, method: "tasks/send",
      params: { id: "task-x", message: { role: "user", parts: [] } },
    });
    expect(res.error?.code).toBe(-32602);
  });

  // ── 7–8. tasks/get ────────────────────────────────────────────────────────

  it("7. tasks/get — returns task by id", async () => {
    const { handleA2ARequest } = await import("../a2a/server.js");
    const row = { id: "task-2", title: "Source candidates", description: null, status: "in_progress", createdAt: new Date() };
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([row]),
    };

    const res = await handleA2ARequest(db, "comp-1", {
      jsonrpc: "2.0", id: 5, method: "tasks/get",
      params: { id: "task-2" },
    });

    expect(res.error).toBeUndefined();
    expect((res.result as any).id).toBe("task-2");
    expect((res.result as any).status.state).toBe("working");
  });

  it("8. tasks/get — returns TASK_NOT_FOUND for unknown id", async () => {
    const { handleA2ARequest } = await import("../a2a/server.js");
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([]),
    };

    const res = await handleA2ARequest(db, "comp-1", {
      jsonrpc: "2.0", id: 6, method: "tasks/get",
      params: { id: "task-unknown" },
    });

    expect(res.error?.code).toBe(-32001);
  });

  // ── 9–10. tasks/cancel ────────────────────────────────────────────────────

  it("9. tasks/cancel — sets status to cancelled", async () => {
    const { handleA2ARequest } = await import("../a2a/server.js");
    const existing = { id: "task-3", status: "in_progress" };
    const cancelled = { id: "task-3", title: "Old task", description: null, status: "cancelled", createdAt: new Date() };
    const mockReturning = vi.fn().mockResolvedValue([cancelled]);
    const mockWhere     = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet       = vi.fn().mockReturnValue({ where: mockWhere });
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([existing]),
      update: vi.fn().mockReturnValue({ set: mockSet }),
    };

    const res = await handleA2ARequest(db, "comp-1", {
      jsonrpc: "2.0", id: 7, method: "tasks/cancel",
      params: { id: "task-3" },
    });

    expect(res.error).toBeUndefined();
    expect((res.result as any).status.state).toBe("canceled");
  });

  it("10. tasks/cancel — returns TASK_NOT_CANCELABLE for done task", async () => {
    const { handleA2ARequest } = await import("../a2a/server.js");
    const existing = { id: "task-4", status: "done" };
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([existing]),
    };

    const res = await handleA2ARequest(db, "comp-1", {
      jsonrpc: "2.0", id: 8, method: "tasks/cancel",
      params: { id: "task-4" },
    });

    expect(res.error?.code).toBe(-32002);
  });
});
