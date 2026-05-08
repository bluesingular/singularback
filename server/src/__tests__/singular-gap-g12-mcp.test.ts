/**
 * G12 — MCP Server unit tests (tests 1–10)
 *
 * Route tests (11–14) are in singular-gap-g12-mcp-routes.test.ts
 *
 * Tests:
 *  1.  skillToMcpTool — tool name is {agentSlug}_{skillSlug} (normalised)
 *  2.  skillToMcpTool — description comes from skill purpose field
 *  3.  skillToMcpTool — required inputs are listed in inputSchema.required
 *  4.  skillToMcpTool — file type inputs become JSON Schema string + format
 *  5.  skillToMcpTool — skill with no inputs gets task_description fallback
 *  6.  handleInitialize — returns MCP protocol version and server info
 *  7.  handleToolsList — returns tools array built from agent × skill pairs
 *  8.  handleToolsList — skips unparseable skill markdown gracefully
 *  9.  handleToolsCall — creates a task and returns taskId in content
 * 10.  handleToolsCall — returns method-not-found error for unknown tool name
 * 11.  handleJsonRpc — returns parse error for non-JSON-RPC body
 * 12.  handleJsonRpc — returns method-not-found for unsupported method
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("@paperclipai/db", () => ({
  agents:        { id: "id", companyId: "companyId", name: "name", status: "status" },
  companySkills: { slug: "slug", name: "name", markdown: "markdown", companyId: "companyId" },
  issues:        { id: "id", companyId: "companyId", title: "title", description: "description",
                   status: "status", priority: "priority", assigneeAgentId: "assigneeAgentId",
                   originKind: "originKind", skillType: "skillType" },
  mcpApiKeys:    { id: "id", companyId: "companyId", keyHash: "keyHash", revokedAt: "revokedAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq:     (...a: any[]) => ({ op: "eq",     a }),
  and:    (...a: any[]) => ({ op: "and",    a }),
  isNull: (...a: any[]) => ({ op: "isNull", a }),
}));

vi.mock("../queue/emit.js", () => ({
  emit: { heartbeat: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../skills/parser.js", () => ({
  parseSkill: vi.fn(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENT_ID   = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TASK_ID    = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const PARSED_SKILL = {
  name:         "qualification-cv",
  tier:         1,
  gdprRequired: true,
  webAccess:    false,
  webScope:     "open",
  autonomyTier: "A",
  tools:        [],
  description:  "Qualifies CVs",
  body:         "You are...",
  purpose:      "Évalue et score les CVs entrants",
  dataCategories: ["cv_data"],
  inputs: [
    { name: "cv_document",  type: "file",   required: true,  description: "CV du candidat", personalData: true },
    { name: "job_ref",      type: "string", required: false, description: "Référence du poste", personalData: false },
  ],
  outputSchema: null,
  aiAct: { riskLevel: "limited", automatedDecision: false, profiling: true, article22Applicable: false },
  configParams: [],
};

const EMPTY_SKILL = { ...PARSED_SKILL, name: "simple-task", inputs: [], purpose: "Simple task" };

// ── DB mock helpers ───────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const c: any = {};
  for (const m of ["from", "where", "orderBy", "limit"]) c[m] = vi.fn().mockReturnValue(c);
  c.then = (res: any, rej: any) => Promise.resolve(rows).then(res, rej);
  return c;
}

// ── toolSchema tests ──────────────────────────────────────────────────────────

describe("G12 — skillToMcpTool", () => {
  it("1. tool name is {agentSlug}_{skillSlug} normalised", async () => {
    const { skillToMcpTool } = await import("../mcp/toolSchema.js");
    const tool = skillToMcpTool("Sophie Sourcing", PARSED_SKILL as any);
    expect(tool.name).toBe("sophie_sourcing_qualification_cv");
  });

  it("2. description comes from skill purpose field", async () => {
    const { skillToMcpTool } = await import("../mcp/toolSchema.js");
    const tool = skillToMcpTool("Sophie", PARSED_SKILL as any);
    expect(tool.description).toBe("Évalue et score les CVs entrants");
  });

  it("3. required inputs are listed in inputSchema.required", async () => {
    const { skillToMcpTool } = await import("../mcp/toolSchema.js");
    const tool = skillToMcpTool("Sophie", PARSED_SKILL as any);
    expect(tool.inputSchema.required).toContain("cv_document");
    expect(tool.inputSchema.required).not.toContain("job_ref");
  });

  it("4. file-type inputs become string with uri-or-base64 format", async () => {
    const { skillToMcpTool } = await import("../mcp/toolSchema.js");
    const tool = skillToMcpTool("Sophie", PARSED_SKILL as any);
    const prop = tool.inputSchema.properties["cv_document"];
    expect(prop.type).toBe("string");
    expect(prop.format).toBe("uri-or-base64");
  });

  it("5. skill with no declared inputs gets task_description fallback", async () => {
    const { skillToMcpTool } = await import("../mcp/toolSchema.js");
    const tool = skillToMcpTool("Marc", EMPTY_SKILL as any);
    expect(tool.inputSchema.properties).toHaveProperty("task_description");
    expect(tool.inputSchema.required).toContain("task_description");
  });
});

// ── handleJsonRpc tests ───────────────────────────────────────────────────────

describe("G12 — handleJsonRpc / handleInitialize", () => {
  beforeEach(() => vi.clearAllMocks());

  it("6. handleInitialize returns MCP protocol version and serverInfo", async () => {
    const { handleJsonRpc, MCP_PROTOCOL_VERSION } = await import("../mcp/server.js");
    const db: any = {};
    const res = await handleJsonRpc(db, COMPANY_ID, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } },
    });
    expect(res.result).toMatchObject({
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo:      { name: "swwarm" },
      capabilities:    { tools: {} },
    });
    expect(res.error).toBeUndefined();
  });

  it("11. returns parse error for non-JSON-RPC body", async () => {
    const { handleJsonRpc } = await import("../mcp/server.js");
    const res = await handleJsonRpc({} as any, COMPANY_ID, "not-an-object");
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32700);
  });

  it("12. returns method-not-found for unsupported method", async () => {
    const { handleJsonRpc } = await import("../mcp/server.js");
    const res = await handleJsonRpc({} as any, COMPANY_ID, { jsonrpc: "2.0", id: 1, method: "unknown/method" });
    expect(res.error!.code).toBe(-32601);
  });
});

describe("G12 — handleToolsList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("7. returns tools array built from agent × skill pairs", async () => {
    const { parseSkill } = await import("../skills/parser.js");
    vi.mocked(parseSkill).mockReturnValue(PARSED_SKILL as any);

    const db: any = {
      select: vi.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: AGENT_ID, name: "Sophie" }]))
        .mockReturnValueOnce(makeSelectChain([{ slug: "qualification-cv", name: "Qualification CV", markdown: "---\nname: qualification-cv\n---\n" }])),
    };

    const { handleJsonRpc } = await import("../mcp/server.js");
    const res = await handleJsonRpc(db, COMPANY_ID, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.error).toBeUndefined();
    const tools = (res.result as any).tools;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]).toHaveProperty("name");
    expect(tools[0]).toHaveProperty("inputSchema");
  });

  it("8. skips unparseable skill markdown gracefully", async () => {
    const { parseSkill } = await import("../skills/parser.js");
    vi.mocked(parseSkill).mockImplementation(() => { throw new Error("bad yaml"); });

    const db: any = {
      select: vi.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: AGENT_ID, name: "Sophie" }]))
        .mockReturnValueOnce(makeSelectChain([{ slug: "broken", name: "Broken", markdown: "not yaml" }])),
    };

    const { handleJsonRpc } = await import("../mcp/server.js");
    const res = await handleJsonRpc(db, COMPANY_ID, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.error).toBeUndefined();
    expect((res.result as any).tools).toHaveLength(0); // skipped
  });
});

describe("G12 — handleToolsCall", () => {
  beforeEach(() => vi.clearAllMocks());

  it("9. creates a task and returns taskId in content", async () => {
    const { parseSkill } = await import("../skills/parser.js");
    vi.mocked(parseSkill).mockReturnValue(PARSED_SKILL as any);

    const db: any = {
      select: vi.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: AGENT_ID, name: "Sophie" }]))
        .mockReturnValueOnce(makeSelectChain([{ slug: "qualification-cv", markdown: "..." }])),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: TASK_ID }]),
        }),
      }),
    };

    const { handleJsonRpc } = await import("../mcp/server.js");
    const res = await handleJsonRpc(db, COMPANY_ID, {
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "sophie_qualification_cv", arguments: { cv_document: "base64..." } },
    });

    expect(res.error).toBeUndefined();
    const result = res.result as any;
    expect(result.taskId).toBe(TASK_ID);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain(TASK_ID);
  });

  it("10. returns method-not-found error for unknown tool name", async () => {
    const { parseSkill } = await import("../skills/parser.js");
    vi.mocked(parseSkill).mockReturnValue(PARSED_SKILL as any);

    const db: any = {
      select: vi.fn()
        .mockReturnValueOnce(makeSelectChain([{ id: AGENT_ID, name: "Sophie" }]))
        .mockReturnValueOnce(makeSelectChain([{ slug: "qualification-cv", markdown: "..." }])),
    };

    const { handleJsonRpc } = await import("../mcp/server.js");
    const res = await handleJsonRpc(db, COMPANY_ID, {
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "nonexistent_tool", arguments: {} },
    });

    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32601);
    expect(res.error!.message).toContain("nonexistent_tool");
  });
});
