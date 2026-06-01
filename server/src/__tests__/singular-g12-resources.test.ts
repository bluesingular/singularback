/**
 * G12 — MCP resources/list + resources/read tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleJsonRpc, MCP_PROTOCOL_VERSION } from "../mcp/server.js";

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeDb(memoryRows: any[] = []) {
  const db = {
    select: vi.fn().mockReturnThis(),
    from:   vi.fn().mockReturnThis(),
    where:  vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit:  vi.fn().mockResolvedValue(memoryRows),
  } as any;
  return db;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("G12 — resources/list", () => {
  it("1. resources/list returns memory entries as MCP resources", async () => {
    const db = makeDb([
      { id: "mem-1", content: "Sophie qualification workflow", source: "task" },
      { id: "mem-2", content: "Client Dupont contact notes",   source: "agent" },
    ]);

    const result = await handleJsonRpc(db, COMPANY_ID, {
      jsonrpc: "2.0", id: 1, method: "resources/list",
    });

    expect(result.error).toBeUndefined();
    const { resources } = result.result as any;
    expect(resources).toHaveLength(2);
    expect(resources[0].uri).toMatch(/^swwarm:\/\/memory\//);
    expect(resources[0].mimeType).toBe("text/plain");
  });

  it("2. empty memory → empty resources array", async () => {
    const db = makeDb([]);
    const result = await handleJsonRpc(db, COMPANY_ID, {
      jsonrpc: "2.0", id: 1, method: "resources/list",
    });
    expect((result.result as any).resources).toHaveLength(0);
  });

  it("3. initialize advertises resources capability", async () => {
    const db = makeDb();
    const result = await handleJsonRpc(db, COMPANY_ID, {
      jsonrpc: "2.0", id: 1, method: "initialize",
    });
    const caps = (result.result as any).capabilities;
    expect(caps).toHaveProperty("resources");
    expect(caps).toHaveProperty("tools");
  });
});

describe("G12 — resources/read", () => {
  it("4. resources/read returns content for valid URI", async () => {
    const memId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const db = {
      select:  vi.fn().mockReturnThis(),
      from:    vi.fn().mockReturnThis(),
      where:   vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit:   vi.fn().mockResolvedValue([{
        content:   "Contenu de la mémoire",
        companyId: COMPANY_ID,
      }]),
    } as any;

    const result = await handleJsonRpc(db, COMPANY_ID, {
      jsonrpc: "2.0", id: 2, method: "resources/read",
      params: { uri: `swwarm://memory/${memId}` },
    });

    expect(result.error).toBeUndefined();
    const { contents } = result.result as any;
    expect(contents[0].text).toBe("Contenu de la mémoire");
    expect(contents[0].mimeType).toBe("text/plain");
  });

  it("5. resources/read rejects invalid URI format", async () => {
    const db = makeDb();
    const result = await handleJsonRpc(db, COMPANY_ID, {
      jsonrpc: "2.0", id: 2, method: "resources/read",
      params: { uri: "invalid://not-a-memory-uri" },
    });
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe(-32602); // INVALID_PARAMS
  });

  it("6. resources/read rejects resource from different company", async () => {
    const memId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const db = {
      select:  vi.fn().mockReturnThis(),
      from:    vi.fn().mockReturnThis(),
      where:   vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit:   vi.fn().mockResolvedValue([{
        content:   "Other company memory",
        companyId: "different-company-id",
      }]),
    } as any;

    const result = await handleJsonRpc(db, COMPANY_ID, {
      jsonrpc: "2.0", id: 2, method: "resources/read",
      params: { uri: `swwarm://memory/${memId}` },
    });
    expect(result.error).toBeDefined();
  });

  it("7. missing URI param → invalid params error", async () => {
    const db = makeDb();
    const result = await handleJsonRpc(db, COMPANY_ID, {
      jsonrpc: "2.0", id: 2, method: "resources/read",
      params: {},
    });
    expect(result.error?.code).toBe(-32602);
  });
});
