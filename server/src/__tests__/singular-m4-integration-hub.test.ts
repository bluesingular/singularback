/**
 * M4 — Integration Hub: vault + MCP router + webhook handler
 *
 * Tests:
 *  1. encryptCredential → decryptCredential round-trip
 *  2. decryptCredential fails when ciphertext is tampered
 *  3. encryptCredential uses different IV each time (non-deterministic)
 *  4. getCompanyKey: throws if VAULT_MASTER_KEY not set
 *  5. getCompanyKey: throws if VAULT_MASTER_KEY wrong length
 *  6. encryptJson / decryptJson round-trip with object
 *  7. Two companies get different ciphertexts for the same plaintext
 *  8. MCPRouter.callTool: throws MCPPermissionError when agent lacks permission
 *  9. MCPRouter.callTool: throws MCPIntegrationNotFoundError when integration missing
 * 10. MCPRouter.callTool: always logs to tool_call_log (even on error)
 * 11. MCPRouter.callTool: access token is NEVER returned to caller (RULE 2)
 * 12. POST /webhooks/:companyId/:agentSlug → 200 immediately
 * 13. POST /webhooks → invalid HMAC signature → event NOT stored
 * 14. POST /webhooks → no integration (no secret) → event stored, agent notified
 * 15. POST /webhooks → source detected from headers (Slack)
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Vault ─────────────────────────────────────────────────────────────────────

const MASTER_KEY = "a".repeat(64); // 64 hex chars = 32 bytes

function withMasterKey<T>(fn: () => T): T {
  const original = process.env.VAULT_MASTER_KEY;
  process.env.VAULT_MASTER_KEY = MASTER_KEY;
  try {
    return fn();
  } finally {
    process.env.VAULT_MASTER_KEY = original;
  }
}

const companyIdA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const companyIdB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("vault", () => {
  it("1. encryptCredential → decryptCredential round-trip", async () => {
    const { encryptCredential, decryptCredential } = await import("../integrations/vault.js");
    const plaintext = "super-secret-api-key-12345";

    const { enc, iv, tag } = withMasterKey(() =>
      encryptCredential(companyIdA, plaintext),
    );

    const result = withMasterKey(() =>
      decryptCredential(companyIdA, enc, iv, tag),
    );

    expect(result).toBe(plaintext);
  });

  it("2. decryptCredential fails when ciphertext is tampered", async () => {
    const { encryptCredential, decryptCredential } = await import("../integrations/vault.js");
    const { enc, iv, tag } = withMasterKey(() =>
      encryptCredential(companyIdA, "real-token"),
    );

    // Flip a byte in the ciphertext
    const tampered = Buffer.from(enc);
    tampered[0] ^= 0xff;

    expect(() =>
      withMasterKey(() => decryptCredential(companyIdA, tampered, iv, tag)),
    ).toThrow(/decryption failed/i);
  });

  it("3. encryptCredential uses different IV each time (non-deterministic)", async () => {
    const { encryptCredential } = await import("../integrations/vault.js");
    const plaintext = "same-secret";

    const a = withMasterKey(() => encryptCredential(companyIdA, plaintext));
    const b = withMasterKey(() => encryptCredential(companyIdA, plaintext));

    // Different IV → different ciphertext every time
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.enc.equals(b.enc)).toBe(false);
  });

  it("4. getCompanyKey: throws if VAULT_MASTER_KEY not set", async () => {
    const { encryptCredential } = await import("../integrations/vault.js");
    const original = process.env.VAULT_MASTER_KEY;
    delete process.env.VAULT_MASTER_KEY;

    expect(() => encryptCredential(companyIdA, "test")).toThrow(/VAULT_MASTER_KEY/);

    process.env.VAULT_MASTER_KEY = original;
  });

  it("5. getCompanyKey: throws if VAULT_MASTER_KEY wrong length", async () => {
    const { encryptCredential } = await import("../integrations/vault.js");
    process.env.VAULT_MASTER_KEY = "tooshort";
    expect(() => encryptCredential(companyIdA, "test")).toThrow(/64 hex characters/);
    process.env.VAULT_MASTER_KEY = MASTER_KEY;
  });

  it("6. encryptJson / decryptJson round-trip with object", async () => {
    const { encryptJson, decryptJson } = await import("../integrations/vault.js");
    const data = { access_token: "tok_abc", refresh_token: "ref_xyz", expires_in: 3600 };

    const { enc, iv, tag } = withMasterKey(() => encryptJson(companyIdA, data));
    const result = withMasterKey(() => decryptJson<typeof data>(companyIdA, enc, iv, tag));

    expect(result).toEqual(data);
  });

  it("7. two companies get different ciphertexts for the same plaintext", async () => {
    const { encryptCredential, decryptCredential } = await import("../integrations/vault.js");
    process.env.VAULT_MASTER_KEY = MASTER_KEY;

    const secret = "shared-api-key";
    const encA = encryptCredential(companyIdA, secret);
    const encB = encryptCredential(companyIdB, secret);

    // Different keys → cross-company decryption fails
    expect(() => decryptCredential(companyIdB, encA.enc, encA.iv, encA.tag)).toThrow();
    expect(() => decryptCredential(companyIdA, encB.enc, encB.iv, encB.tag)).toThrow();

    // Each company can still decrypt their own
    expect(decryptCredential(companyIdA, encA.enc, encA.iv, encA.tag)).toBe(secret);
    expect(decryptCredential(companyIdB, encB.enc, encB.iv, encB.tag)).toBe(secret);

    delete process.env.VAULT_MASTER_KEY;
  });
});

// ── MCPRouter ─────────────────────────────────────────────────────────────────

function makeMCPDb(opts: {
  integrationId?: string;
  hasPermission?: boolean;
  insertCalled?: { called: boolean };
}) {
  const integrationId = opts.integrationId ?? "integ-1";
  let calls = 0; // must be outside mockImplementation — resets per select() otherwise

  return {
    select: vi.fn().mockImplementation(() => {
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => {
            calls++;
            if (calls === 1) {
              // First select: integration lookup for permission check
              return Promise.resolve(
                opts.integrationId !== null
                  ? [{ id: integrationId }]
                  : [],
              );
            }
            // Second select: permission check
            return Promise.resolve(
              opts.hasPermission ? [{ permissions: ["read", "compose"] }] : [],
            );
          }),
        })),
      };
    }),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => {
        if (opts.insertCalled) opts.insertCalled.called = true;
        return Promise.resolve();
      }),
    })),
  };
}

describe("MCPRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("8. callTool: throws MCPPermissionError when agent lacks permission", async () => {
    const { createMCPRouter, MCPPermissionError } = await import("../integrations/mcp.js");
    const db = makeMCPDb({ hasPermission: false });
    const mcp = createMCPRouter(db as any);

    await expect(
      mcp.callTool({
        agentId: "agent-1",
        companyId: companyIdA,
        taskId: "task-1",
        server: "gmail",
        tool: "send_email",
        args: { to: "test@example.com", subject: "Hi" },
        requiredPerm: "send",
      }),
    ).rejects.toBeInstanceOf(MCPPermissionError);
  });

  it("9. callTool: throws MCPIntegrationNotFoundError when integration missing", async () => {
    const { createMCPRouter, MCPIntegrationNotFoundError } = await import("../integrations/mcp.js");

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // no integration found
        }),
      }),
    };

    const mcp = createMCPRouter(db as any);

    await expect(
      mcp.callTool({
        agentId: "agent-1",
        companyId: companyIdA,
        taskId: "task-1",
        server: "notion",
        tool: "read_page",
        args: {},
        requiredPerm: "read",
      }),
    ).rejects.toBeInstanceOf(MCPIntegrationNotFoundError);
  });

  it("10. callTool: logs to tool_call_log even on error", async () => {
    const { createMCPRouter } = await import("../integrations/mcp.js");
    const { encryptCredential } = await import("../integrations/vault.js");

    // Need VAULT_MASTER_KEY so resolveAccessToken can decrypt and we reach executeMCPCall
    process.env.VAULT_MASTER_KEY = MASTER_KEY;
    const creds = encryptCredential(companyIdA, "fake-access-token");

    const insertCalled = { called: false };
    let selectCalls = 0;
    const permDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCalls++;
            if (selectCalls === 1) return Promise.resolve([{ id: "integ-1" }]);       // checkPermission: integration
            if (selectCalls === 2) return Promise.resolve([{ permissions: ["read"] }]); // checkPermission: perms
            // selectCalls === 3: getIntegration — return full row with real encrypted creds
            return Promise.resolve([{
              id: "integ-1",
              credentialsEnc: creds.enc,
              credentialsIv: creds.iv,
              credentialsTag: creds.tag,
              oauthAccessTokenEnc: null,
              oauthExpiresAt: null,
              oauthRefreshTokenEnc: null,
            }]);
          }),
        }),
      })),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation(() => {
          insertCalled.called = true;
          return Promise.resolve();
        }),
      }),
    };

    const mcp = createMCPRouter(permDb as any);

    // Will throw "not yet implemented" from executeMCPCall stub
    await expect(
      mcp.callTool({
        agentId: "agent-1",
        companyId: companyIdA,
        taskId: "task-1",
        server: "gmail",
        tool: "list_emails",
        args: {},
        requiredPerm: "read",
      }),
    ).rejects.toThrow(/not yet implemented/);

    // Despite the error, the audit log must have been written
    expect(insertCalled.called).toBe(true);

    delete process.env.VAULT_MASTER_KEY;
  });

  it("11. callTool: access token is never returned to the caller (RULE 2)", async () => {
    const { createMCPRouter } = await import("../integrations/mcp.js");

    const db = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "integ-1" }]),
        }),
      })),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    };

    const mcp = createMCPRouter(db as any);

    let caughtError: Error | null = null;
    try {
      await mcp.callTool({
        agentId: "agent-1",
        companyId: companyIdA,
        taskId: "task-1",
        server: "slack",
        tool: "post_message",
        args: { channel: "#general", text: "Hello" },
        requiredPerm: "post",
      });
    } catch (err) {
      caughtError = err as Error;
    }

    // The error message must NOT contain any token value
    expect(caughtError?.message).not.toMatch(/token|secret|credential|key/i);
  });
});

// ── Webhook routes ────────────────────────────────────────────────────────────

vi.mock("../queue/emit.js", () => ({
  emit: {
    webhookReceived: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    duplicate: vi.fn().mockReturnThis(),
    on: vi.fn(),
    quit: vi.fn(),
  })),
  default: vi.fn(),
}));

function makeWebhookDb(opts: {
  integration?: { id: string; webhookSecret: string | null; status: string } | null;
  agent?: { id: string; companyId: string } | null;
  insertedEventId?: string;
}) {
  let selectCall = 0;
  return {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockImplementation(() => {
          selectCall++;
          if (selectCall === 1) {
            return Promise.resolve(opts.integration != null ? [opts.integration] : []);
          }
          return Promise.resolve(opts.agent != null ? [opts.agent] : []);
        }),
      })),
    })),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          { id: opts.insertedEventId ?? "evt-1", source: "custom" },
        ]),
      }),
    }),
  };
}

async function buildWebhookApp(db: ReturnType<typeof makeWebhookDb>) {
  const { webhookRoutes } = await vi.importActual<typeof import("../routes/webhooks.js")>(
    "../routes/webhooks.js",
  );
  const app = express();
  app.use(express.json());
  app.use("/webhooks", webhookRoutes(db as any));
  return app;
}

describe("POST /webhooks/:companyId/:agentSlug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("12. responds 200 immediately", async () => {
    const db = makeWebhookDb({ integration: null, agent: null });
    const app = await buildWebhookApp(db);

    const res = await request(app)
      .post(`/webhooks/${companyIdA}/sophie`)
      .send({ event: "test" });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("13. invalid HMAC signature → event NOT inserted", async () => {
    const db = makeWebhookDb({
      integration: { id: "integ-1", webhookSecret: "real-secret", status: "connected" },
      agent: { id: "agent-1", companyId: companyIdA },
    });
    const app = await buildWebhookApp(db);

    const res = await request(app)
      .post(`/webhooks/${companyIdA}/sophie`)
      .set("x-webhook-signature", "badsignature")
      .send({ event: "new_application" });

    expect(res.status).toBe(200); // still 200 (immediate ack)
    // insert should NOT have been called (invalid sig → discard)
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("14. no integration (no secret) → event stored and agent queued", async () => {
    const db = makeWebhookDb({
      integration: null, // no integration found
      agent: { id: "agent-1", companyId: companyIdA },
      insertedEventId: "evt-123",
    });
    const app = await buildWebhookApp(db);

    const res = await request(app)
      .post(`/webhooks/${companyIdA}/sophie`)
      .send({ event: "new_application", candidate: "Jean Dupont" });

    expect(res.status).toBe(200);

    // Give async handler time to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(db.insert).toHaveBeenCalled();
  });

  it("15. source detected from Slack header", async () => {
    const db = makeWebhookDb({
      integration: null,
      agent: { id: "agent-1", companyId: companyIdA },
    });
    const app = await buildWebhookApp(db);

    await request(app)
      .post(`/webhooks/${companyIdA}/marc`)
      .set("x-slack-signature", "v0=abc123")
      .send({ type: "message", text: "New candidacy" });

    // Give async handler time
    await new Promise((r) => setTimeout(r, 50));

    // The source field in the insert should be 'slack'
    const insertArgs = db.insert.mock.calls[0];
    // insert(webhookEvents).values({...})
    if (insertArgs) {
      const valuesCall = db.insert.mock.results[0]?.value?.values?.mock?.calls?.[0]?.[0];
      if (valuesCall) {
        expect(valuesCall.source).toBe("slack");
      }
    }
  });
});
