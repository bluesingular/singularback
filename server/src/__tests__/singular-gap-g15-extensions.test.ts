/**
 * G15 — Plugin/extension system: service unit tests (tests 1–10)
 *
 * Route tests (11–18) are in singular-gap-g15-extensions-routes.test.ts
 *
 * Tests:
 *  1.  signPayload — deterministic HMAC-SHA256 "sha256=<hex>" prefix
 *  2.  generateWebhookSecret — returns 64-char hex string
 *  3.  registerActionType — inserts record and returns it
 *  4.  listActionTypes — returns only active records for company
 *  5.  getActionType — returns single record by id + companyId
 *  6.  getActionType — returns null when not found
 *  7.  deactivateActionType — sets isActive=false, returns id
 *  8.  deactivateActionType — returns null when not found
 *  9.  invokeActionType — POSTs to webhookUrl with correct signature header
 * 10.  invokeActionType — throws when action type not found
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

beforeEach(() => { vi.clearAllMocks(); });

describe("G15 — Action type registry service", () => {

  // ── 1. signPayload ────────────────────────────────────────────────────────

  it("1. signPayload — deterministic HMAC-SHA256 with sha256= prefix", async () => {
    const { signPayload } = await import("../extensions/action-type-registry.js");
    const secret = "mysecret";
    const body   = '{"hello":"world"}';
    const sig = signPayload(secret, body);
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(signPayload(secret, body)).toBe(sig); // deterministic
    expect(signPayload("other", body)).not.toBe(sig); // different secret → different sig
  });

  // ── 2. generateWebhookSecret ──────────────────────────────────────────────

  it("2. generateWebhookSecret — returns 64-char hex string", async () => {
    const { generateWebhookSecret } = await import("../extensions/action-type-registry.js");
    const s = generateWebhookSecret();
    expect(s).toMatch(/^[a-f0-9]{64}$/);
    expect(generateWebhookSecret()).not.toBe(s); // random each time
  });

  // ── 3. registerActionType ─────────────────────────────────────────────────

  it("3. registerActionType — inserts and returns record", async () => {
    const { registerActionType } = await import("../extensions/action-type-registry.js");
    const returned = {
      id: "at-1", companyId: "comp-1", slug: "send-sms",
      name: "Send SMS", description: null,
      inputSchema: { type: "object" }, outputSchema: {},
      webhookUrl: "https://example.com/hook", isActive: true,
      createdAt: new Date(),
    };
    const mockReturning = vi.fn().mockResolvedValue([returned]);
    const mockValues    = vi.fn().mockReturnValue({ returning: mockReturning });
    const db: any = { insert: vi.fn().mockReturnValue({ values: mockValues }) };

    const row = await registerActionType(db, {
      companyId: "comp-1", slug: "send-sms", name: "Send SMS",
      webhookUrl: "https://example.com/hook",
    });

    expect(db.insert).toHaveBeenCalled();
    expect(row.slug).toBe("send-sms");
    expect(row.isActive).toBe(true);
  });

  // ── 4. listActionTypes ────────────────────────────────────────────────────

  it("4. listActionTypes — returns active records for company", async () => {
    const { listActionTypes } = await import("../extensions/action-type-registry.js");
    const rows = [
      { id: "at-1", slug: "send-sms", name: "Send SMS", isActive: true },
      { id: "at-2", slug: "log-event", name: "Log Event", isActive: true },
    ];
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue(rows),
    };

    const result = await listActionTypes(db, "comp-1");
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("send-sms");
  });

  // ── 5–6. getActionType ────────────────────────────────────────────────────

  it("5. getActionType — returns single record by id + companyId", async () => {
    const { getActionType } = await import("../extensions/action-type-registry.js");
    const row = { id: "at-1", slug: "send-sms", name: "Send SMS", isActive: true, companyId: "comp-1" };
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([row]),
    };

    const result = await getActionType(db, "at-1", "comp-1");
    expect(result?.id).toBe("at-1");
  });

  it("6. getActionType — returns null when not found", async () => {
    const { getActionType } = await import("../extensions/action-type-registry.js");
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([]),
    };

    const result = await getActionType(db, "at-missing", "comp-1");
    expect(result).toBeNull();
  });

  // ── 7–8. deactivateActionType ─────────────────────────────────────────────

  it("7. deactivateActionType — returns id on success", async () => {
    const { deactivateActionType } = await import("../extensions/action-type-registry.js");
    const mockReturning = vi.fn().mockResolvedValue([{ id: "at-1" }]);
    const mockWhere     = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet       = vi.fn().mockReturnValue({ where: mockWhere });
    const db: any = { update: vi.fn().mockReturnValue({ set: mockSet }) };

    const result = await deactivateActionType(db, "at-1", "comp-1");
    expect(result?.id).toBe("at-1");
  });

  it("8. deactivateActionType — returns null when not found", async () => {
    const { deactivateActionType } = await import("../extensions/action-type-registry.js");
    const mockReturning = vi.fn().mockResolvedValue([]);
    const mockWhere     = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet       = vi.fn().mockReturnValue({ where: mockWhere });
    const db: any = { update: vi.fn().mockReturnValue({ set: mockSet }) };

    const result = await deactivateActionType(db, "at-missing", "comp-1");
    expect(result).toBeNull();
  });

  // ── 9–10. invokeActionType ────────────────────────────────────────────────

  it("9. invokeActionType — POSTs to webhook with correct signature", async () => {
    const { invokeActionType, signPayload } = await import("../extensions/action-type-registry.js");
    const secret = "abc123secret";
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([{
        webhookUrl: "https://example.com/hook",
        webhookSecret: secret,
        isActive: true,
      }]),
    };

    const capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    global.fetch = vi.fn().mockImplementation(async (_url: string, opts: any) => {
      capturedBody = opts.body;
      for (const [k, v] of Object.entries(opts.headers)) {
        capturedHeaders[k as string] = v as string;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: "ok" }),
      };
    }) as any;

    const result = await invokeActionType(db, "at-1", "comp-1", { phone: "+33612345678" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(capturedHeaders["X-Swwarm-Signature"]).toBe(signPayload(secret, capturedBody));
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
  });

  it("10. invokeActionType — throws when action type not found", async () => {
    const { invokeActionType } = await import("../extensions/action-type-registry.js");
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([]),
    };

    await expect(invokeActionType(db, "at-missing", "comp-1", {}))
      .rejects.toThrow("Action type not found");
  });
});
