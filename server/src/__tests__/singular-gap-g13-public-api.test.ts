/**
 * G13 — Public API: middleware + OpenAPI spec unit tests (tests 1–10)
 *
 * Route tests (11–18) are in singular-gap-g13-public-api-routes.test.ts
 *
 * Tests:
 *  1.  hashApiKey — deterministic SHA-256 hex
 *  2.  checkRateLimit — allows requests under limit
 *  3.  checkRateLimit — blocks when limit reached
 *  4.  checkRateLimit — window resets after 1 hour
 *  5.  checkRateLimit — different keyIds have independent buckets
 *  6.  publicApiAuth — 401 when Authorization header missing
 *  7.  publicApiAuth — 401 when key not found in db
 *  8.  publicApiAuth — 401 when key is revoked
 *  9.  publicApiAuth — 429 when rate limit exceeded
 * 10.  buildOpenApiSpec — returns valid OpenAPI 3.0 object with paths
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

// ── Import helpers (no route-level mocks needed here) ────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe("G13 — Public API middleware + OpenAPI spec", () => {

  // ── 1. hashApiKey ──────────────────────────────────────────────────────────

  it("1. hashApiKey — deterministic SHA-256 hex", async () => {
    const { hashApiKey } = await import("../middleware/public-api-auth.js");
    const raw = "spk_abc123";
    const expected = createHash("sha256").update(raw).digest("hex");
    expect(hashApiKey(raw)).toBe(expected);
    expect(hashApiKey(raw)).toBe(hashApiKey(raw)); // idempotent
  });

  // ── 2–5. checkRateLimit ────────────────────────────────────────────────────

  it("2. checkRateLimit — allows requests under limit", async () => {
    const { checkRateLimit, rateLimitStore } = await import("../middleware/public-api-auth.js");
    const keyId = "key-allow-" + Math.random();
    rateLimitStore.delete(keyId);
    expect(checkRateLimit(keyId, 3)).toBe(true);
    expect(checkRateLimit(keyId, 3)).toBe(true);
    expect(checkRateLimit(keyId, 3)).toBe(true);
  });

  it("3. checkRateLimit — blocks when limit reached", async () => {
    const { checkRateLimit, rateLimitStore } = await import("../middleware/public-api-auth.js");
    const keyId = "key-block-" + Math.random();
    rateLimitStore.delete(keyId);
    checkRateLimit(keyId, 2);
    checkRateLimit(keyId, 2);
    expect(checkRateLimit(keyId, 2)).toBe(false); // 3rd request blocked
  });

  it("4. checkRateLimit — window resets after 1 hour (simulated)", async () => {
    const { checkRateLimit, rateLimitStore } = await import("../middleware/public-api-auth.js");
    const keyId = "key-reset-" + Math.random();
    const oldTs = Date.now() - 61 * 60 * 1_000; // 61 minutes ago
    // Seed with old timestamps that should be evicted
    rateLimitStore.set(keyId, { timestamps: [oldTs, oldTs] });
    expect(checkRateLimit(keyId, 2)).toBe(true); // old ones evicted, new fits
  });

  it("5. checkRateLimit — different keyIds have independent buckets", async () => {
    const { checkRateLimit, rateLimitStore } = await import("../middleware/public-api-auth.js");
    const id1 = "key-ind-a-" + Math.random();
    const id2 = "key-ind-b-" + Math.random();
    rateLimitStore.delete(id1);
    rateLimitStore.delete(id2);
    checkRateLimit(id1, 1);
    // id1 exhausted, id2 still free
    expect(checkRateLimit(id1, 1)).toBe(false);
    expect(checkRateLimit(id2, 1)).toBe(true);
  });

  // ── 6–9. publicApiAuth middleware ──────────────────────────────────────────

  function makeReq(authHeader?: string): any {
    return {
      headers: { authorization: authHeader },
      publicApiCompanyId: undefined,
      publicApiKeyId: undefined,
      publicApiScope: undefined,
    };
  }

  function makeRes(): any {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json   = vi.fn().mockReturnValue(res);
    return res;
  }

  it("6. publicApiAuth — 401 when Authorization header missing", async () => {
    const { publicApiAuth } = await import("../middleware/public-api-auth.js");
    const db: any = {};
    const middleware = publicApiAuth(db);
    const req = makeReq(undefined);
    const res = makeRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("7. publicApiAuth — 401 when key not found in db", async () => {
    const { publicApiAuth } = await import("../middleware/public-api-auth.js");
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([]),
    };
    const middleware = publicApiAuth(db);
    const req = makeReq("Bearer spk_notexist");
    const res = makeRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("8. publicApiAuth — 429 when rate limit exceeded", async () => {
    const { publicApiAuth, rateLimitStore } = await import("../middleware/public-api-auth.js");
    const keyId = "test-rate-limit-key";
    // Pre-fill bucket to be at limit
    const now = Date.now();
    rateLimitStore.set(keyId, { timestamps: Array(1000).fill(now) });

    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([{
        id: keyId, companyId: "comp-1", scope: "read_write", rateLimitPerHour: 1000,
      }]),
      update: vi.fn().mockReturnThis(),
      set:    vi.fn().mockReturnThis(),
      catch:  vi.fn(),
    };
    const middleware = publicApiAuth(db);
    const req = makeReq("Bearer spk_somekey");
    const res = makeRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it("9. publicApiAuth — injects companyId and calls next on valid key", async () => {
    const { publicApiAuth, rateLimitStore } = await import("../middleware/public-api-auth.js");
    const keyId = "valid-key-id-" + Math.random();
    rateLimitStore.delete(keyId);

    const mockUpdate = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), catch: vi.fn() };
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([{
        id: keyId, companyId: "comp-abc", scope: "read", rateLimitPerHour: 1000,
      }]),
      update: vi.fn().mockReturnValue(mockUpdate),
    };
    const middleware = publicApiAuth(db);
    const req = makeReq("Bearer spk_validkey");
    const res = makeRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.publicApiCompanyId).toBe("comp-abc");
    expect(req.publicApiScope).toBe("read");
  });

  // ── 10. buildOpenApiSpec ───────────────────────────────────────────────────

  it("10. buildOpenApiSpec — returns valid OpenAPI 3.0 object with all expected paths", async () => {
    const { buildOpenApiSpec } = await import("../api/openapi.js");
    const spec = buildOpenApiSpec("https://app.swwarm.com") as any;

    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info.title).toBe("Swwarm Public API");
    expect(spec.paths["/agents"]).toBeDefined();
    expect(spec.paths["/agents"].get.operationId).toBe("listAgents");
    expect(spec.paths["/tasks"]).toBeDefined();
    expect(spec.paths["/tasks"].get.operationId).toBe("listTasks");
    expect(spec.paths["/tasks"].post.operationId).toBe("createTask");
    expect(spec.paths["/webhooks/subscriptions"]).toBeDefined();
    expect(spec.paths["/webhooks/subscriptions/{id}"]).toBeDefined();
    expect(spec.servers[0].url).toContain("/api/v1");
    expect(spec.components.securitySchemes.BearerAuth).toBeDefined();
  });
});
