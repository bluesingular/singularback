/**
 * @swwarm/sdk tests — TypeScript SDK.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SwwarmClient, SwwarmApiError, verifyWebhookSignature } from "../../../packages/sdk/src/index.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("SwwarmClient", () => {
  it("1. throws if apiKey is missing", () => {
    expect(() => new SwwarmClient({ apiKey: "" })).toThrow("apiKey is required");
  });

  it("2. baseUrl defaults to app.swwarm.com", () => {
    const client = new SwwarmClient({ apiKey: "spk_test" });
    expect((client as any).baseUrl).toBe("https://app.swwarm.com");
  });

  it("3. trailing slash stripped from baseUrl", () => {
    const client = new SwwarmClient({ apiKey: "spk_test", baseUrl: "https://custom.host/" });
    expect((client as any).baseUrl).toBe("https://custom.host");
  });

  it("4. listAgents calls GET /api/v1/agents", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ agents: [{ id: "a1", name: "Sophie", isActive: true, createdAt: "2026-01-01" }] }),
    });
    global.fetch = mockFetch as any;

    const client = new SwwarmClient({ apiKey: "spk_test", baseUrl: "https://test.host" });
    const result = await client.listAgents();
    expect(result.agents).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.host/api/v1/agents",
      expect.objectContaining({ method: "GET", headers: expect.objectContaining({ Authorization: "Bearer spk_test" }) }),
    );
  });

  it("5. createTask calls POST /api/v1/tasks with body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ id: "t1", title: "Test task", status: "open", createdAt: "2026-01-01" }),
    });
    global.fetch = mockFetch as any;

    const client = new SwwarmClient({ apiKey: "spk_test", baseUrl: "https://test.host" });
    const task = await client.createTask({ title: "Test task", agentId: "a1" });
    expect(task.id).toBe("t1");
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toMatchObject({ title: "Test task", agentId: "a1" });
  });

  it("6. non-2xx response throws SwwarmApiError", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ error: "Invalid API key" }),
    }) as any;

    const client = new SwwarmClient({ apiKey: "bad_key", baseUrl: "https://test.host" });
    await expect(client.listAgents()).rejects.toThrow(SwwarmApiError);
    await expect(client.listAgents()).rejects.toMatchObject({ status: 401 });
  });

  it("7. listTasks builds correct query string", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ tasks: [], total: 0 }),
    });
    global.fetch = mockFetch as any;

    const client = new SwwarmClient({ apiKey: "spk_test", baseUrl: "https://test.host" });
    await client.listTasks({ status: "done", limit: 10, offset: 5 });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("status=done");
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=5");
  });

  it("8. createMission calls POST /api/v1/missions", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ ok: true, mission: { id: "m1", title: "New mission", status: "draft", createdAt: "2026-01-01", completedAt: null } }),
    });
    global.fetch = mockFetch as any;

    const client = new SwwarmClient({ apiKey: "spk_test", baseUrl: "https://test.host" });
    const result = await client.createMission({ title: "New mission", brief: "Brief text" });
    expect(result.mission.id).toBe("m1");
  });

  it("9. listMissions calls GET /api/v1/missions", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ missions: [], limit: 20, offset: 0 }),
    });
    global.fetch = mockFetch as any;

    const client = new SwwarmClient({ apiKey: "spk_test", baseUrl: "https://test.host" });
    const result = await client.listMissions({ limit: 5 });
    expect(result.missions).toBeDefined();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/missions");
    expect(url).toContain("limit=5");
  });
});

describe("verifyWebhookSignature", () => {
  it("10. valid HMAC-SHA256 signature passes", async () => {
    const secret  = "webhook-secret-123";
    const payload = '{"event":"task.completed"}';
    // Compute expected signature using subtle crypto
    const enc     = new TextEncoder();
    const key     = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sigBuf  = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    const hex     = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const sig     = `sha256=${hex}`;

    const valid = await verifyWebhookSignature(payload, sig, secret);
    expect(valid).toBe(true);
  });

  it("11. tampered payload fails", async () => {
    const secret  = "webhook-secret-123";
    const payload = '{"event":"task.completed"}';
    const valid   = await verifyWebhookSignature(payload + "x", "sha256=deadbeef", secret);
    expect(valid).toBe(false);
  });
});
