/**
 * G13 — Missions API + Webhook delivery tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { deliverEvent, verifyWebhookSignature } from "../webhooks/delivery.js";

// ── Webhook delivery ──────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe("G13 — webhook delivery", () => {
  it("1. delivers to matching active subscriptions", async () => {
    const delivered: string[] = [];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
    });
    global.fetch = mockFetch as any;

    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([
        {
          id:            "sub-1",
          url:           "https://example.com/hook",
          signingSecret: "test-secret",
          events:        ["task.completed"],
          active:        true,
        },
      ]),
    } as any;

    const results = await deliverEvent(db, {
      event:     "task.completed",
      companyId: "company-1",
      data:      { taskId: "task-1", title: "Test task" },
      timestamp: 1_700_000_000,
    });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("2. skips subscriptions for non-matching event types", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([
        {
          id:            "sub-1",
          url:           "https://example.com/hook",
          signingSecret: "secret",
          events:        ["mission.completed"],  // won't match task.completed
          active:        true,
        },
      ]),
    } as any;

    const results = await deliverEvent(db, {
      event:     "task.completed",
      companyId: "company-1",
      data:      {},
      timestamp: 1_700_000_000,
    });

    expect(results).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("3. wildcard subscription (*) matches all events", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch as any;

    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([
        { id: "sub-1", url: "https://example.com/hook", signingSecret: "s", events: ["*"], active: true },
      ]),
    } as any;

    const results = await deliverEvent(db, {
      event: "agent.status_changed", companyId: "c1", data: {}, timestamp: 0,
    });
    expect(results).toHaveLength(1);
  });

  it("4. no subscriptions → returns empty array", async () => {
    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([]),
    } as any;

    const results = await deliverEvent(db, {
      event: "task.completed", companyId: "c1", data: {}, timestamp: 0,
    });
    expect(results).toHaveLength(0);
  });

  it("5. request headers include all required Swwarm headers", async () => {
    const capturedHeaders: Record<string, string> = {};
    global.fetch = vi.fn().mockImplementation((_url: string, opts: any) => {
      Object.assign(capturedHeaders, opts.headers);
      return Promise.resolve({ ok: true, status: 200 });
    }) as any;

    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([
        { id: "sub-1", url: "https://example.com/hook", signingSecret: "sec", events: ["*"], active: true },
      ]),
    } as any;

    await deliverEvent(db, { event: "task.completed", companyId: "c1", data: {}, timestamp: 1234 });

    expect(capturedHeaders["X-Swwarm-Event"]).toBe("task.completed");
    expect(capturedHeaders["X-Swwarm-Signature"]).toMatch(/^sha256=[0-9a-f]+$/);
    expect(capturedHeaders["X-Swwarm-Delivery"]).toBeDefined();
    expect(capturedHeaders["X-Swwarm-Timestamp"]).toBe("1234");
  });
});

describe("G13 — verifyWebhookSignature", () => {
  it("6. valid signature passes", () => {
    const { createHmac } = require("node:crypto");
    const secret  = "test-secret-key";
    const payload = JSON.stringify({ event: "task.completed", data: {} });
    const sig     = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyWebhookSignature(payload, sig, secret)).toBe(true);
  });

  it("7. tampered payload fails", () => {
    const { createHmac } = require("node:crypto");
    const secret  = "test-secret-key";
    const payload = JSON.stringify({ event: "task.completed" });
    const sig     = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyWebhookSignature(payload + "tampered", sig, secret)).toBe(false);
  });

  it("8. wrong secret fails", () => {
    const { createHmac } = require("node:crypto");
    const secret  = "real-secret";
    const payload = "hello";
    const sig     = "sha256=" + createHmac("sha256", "wrong-secret").update(payload).digest("hex");
    expect(verifyWebhookSignature(payload, sig, secret)).toBe(false);
  });

  it("9. signature without sha256= prefix still works", () => {
    const { createHmac } = require("node:crypto");
    const secret  = "sec";
    const payload = "body";
    const raw = createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyWebhookSignature(payload, raw, secret)).toBe(true);
  });
});
