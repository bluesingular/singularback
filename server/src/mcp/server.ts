/**
 * G12 — MCP Server — JSON-RPC 2.0 handler.
 *
 * Implements the Model Context Protocol (2024-11-05) over HTTP POST.
 * External AI systems (Claude, GPT, Dust…) can:
 *   1. Discover available tools (one per agent × skill pair)
 *   2. Call a tool → creates a task, queues it, returns { taskId }
 *
 * Supported methods:
 *   initialize    — handshake, returns server capabilities
 *   tools/list    — lists all tools for this company
 *   tools/call    — creates a task for the named tool and returns taskId
 *
 * Auth: handled upstream by the route (API key → companyId).
 */

import type { Db } from "@paperclipai/db";
import { agents, companySkills, issues, memoryEntries } from "@paperclipai/db";
import { eq, and } from "drizzle-orm";
import { parseSkill } from "../skills/parser.js";
import { emit } from "../queue/emit.js";
import { skillToMcpTool, buildToolName } from "./toolSchema.js";
import pino from "pino";

const log = pino({ name: "mcp-server" });

// ── MCP protocol constants ────────────────────────────────────────────────────

export const MCP_PROTOCOL_VERSION = "2024-11-05";

// ── JSON-RPC types ────────────────────────────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id:      string | number | null;
  method:  string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id:      string | number | null;
  result?: unknown;
  error?:  { code: number; message: string; data?: unknown };
}

// Standard JSON-RPC error codes
const RPC_PARSE_ERROR      = -32700;
const RPC_METHOD_NOT_FOUND = -32601;
const RPC_INVALID_PARAMS   = -32602;
const RPC_INTERNAL_ERROR   = -32603;

function rpcError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function rpcOk(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleInitialize(id: string | number | null): JsonRpcResponse {
  return rpcOk(id, {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities:    { tools: {}, resources: {} },
    serverInfo:      { name: "swwarm", version: "1.0.0" },
  });
}

async function handleToolsList(
  db: Db,
  companyId: string,
  id: string | number | null,
): Promise<JsonRpcResponse> {
  // Load all agents for the company
  const companyAgents = await (db as any)
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(and(eq(agents.companyId, companyId), eq(agents.status, "idle")));

  // Load all skills for the company
  const skills = await (db as any)
    .select({ slug: companySkills.slug, name: companySkills.name, markdown: companySkills.markdown })
    .from(companySkills)
    .where(eq(companySkills.companyId, companyId));

  const tools = [];
  for (const agent of companyAgents) {
    for (const skill of skills) {
      let parsed;
      try {
        parsed = parseSkill(skill.markdown);
      } catch {
        continue; // skip unparseable skill
      }
      tools.push(skillToMcpTool(agent.name, parsed));
    }
  }

  log.info({ companyId, toolCount: tools.length }, "mcp: tools/list");
  return rpcOk(id, { tools });
}

async function handleToolsCall(
  db: Db,
  companyId: string,
  id: string | number | null,
  params: unknown,
): Promise<JsonRpcResponse> {
  if (!params || typeof params !== "object") {
    return rpcError(id, RPC_INVALID_PARAMS, "params must be an object");
  }

  const { name: toolName, arguments: args } = params as Record<string, unknown>;
  if (typeof toolName !== "string") {
    return rpcError(id, RPC_INVALID_PARAMS, "params.name must be a string");
  }

  // Resolve which agent + skill this tool corresponds to by brute-force matching
  const companyAgents = await (db as any)
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.companyId, companyId));

  const skills = await (db as any)
    .select({ slug: companySkills.slug, markdown: companySkills.markdown })
    .from(companySkills)
    .where(eq(companySkills.companyId, companyId));

  let matchedAgentId: string | null = null;
  let matchedSkillSlug: string | null = null;

  outer: for (const agent of companyAgents) {
    for (const skill of skills) {
      let parsed;
      try { parsed = parseSkill(skill.markdown); } catch { continue; }
      if (buildToolName(agent.name, parsed.name) === toolName) {
        matchedAgentId  = agent.id;
        matchedSkillSlug = parsed.name;
        break outer;
      }
    }
  }

  if (!matchedAgentId || !matchedSkillSlug) {
    return rpcError(id, RPC_METHOD_NOT_FOUND, `Unknown tool: ${toolName}`);
  }

  // Build task title from tool name + arguments summary
  const argSummary = args && typeof args === "object"
    ? Object.entries(args as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
        .join(", ")
    : "";
  const title = `[MCP] ${toolName}${argSummary ? ` — ${argSummary.slice(0, 100)}` : ""}`;

  // Create the task (issue)
  const [task] = await (db as any)
    .insert(issues)
    .values({
      companyId,
      title,
      description: args ? JSON.stringify(args, null, 2) : null,
      status:          "todo",
      priority:        "medium",
      assigneeAgentId: matchedAgentId,
      originKind:      "mcp",
      skillType:       matchedSkillSlug,
    })
    .returning({ id: issues.id });

  // Trigger the agent immediately
  await emit.heartbeat(
    { agentId: matchedAgentId, companyId, triggeredBy: "manual" },
    0,
  );

  log.info({ companyId, toolName, taskId: task.id }, "mcp: tools/call — task created");

  return rpcOk(id, {
    content: [
      {
        type: "text",
        text: `Task created: ${task.id}. Agent is processing your request. Poll GET /companies/${companyId}/tasks/${task.id} for results.`,
      },
    ],
    isError: false,
    taskId:  task.id,
  });
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

// ── resources/list — expose org memory as MCP resources ──────────────────────

async function handleResourcesList(
  db:        Db,
  companyId: string,
  id:        string | number | null,
): Promise<JsonRpcResponse> {
  // Expose the 20 most recent org memory entries as readable resources
  const rows = await (db as any)
    .select({
      id:      memoryEntries.id,
      content: memoryEntries.content,
      source:  (memoryEntries as any).source,
    })
    .from(memoryEntries)
    .where(eq(memoryEntries.companyId, companyId))
    .orderBy(eq(memoryEntries.companyId, companyId)) // latest first via DB default
    .limit(20);

  const resources = rows.map((r: any) => ({
    uri:      `swwarm://memory/${r.id}`,
    name:     `Org memory — ${(r.source ?? "general").slice(0, 50)}`,
    mimeType: "text/plain",
  }));

  log.info({ companyId, resourceCount: resources.length }, "mcp: resources/list");
  return rpcOk(id, { resources });
}

// ── resources/read ────────────────────────────────────────────────────────────

async function handleResourcesRead(
  db:        Db,
  companyId: string,
  id:        string | number | null,
  params:    unknown,
): Promise<JsonRpcResponse> {
  const { uri } = (params as Record<string, string>) ?? {};
  if (!uri || typeof uri !== "string") {
    return rpcError(id, RPC_INVALID_PARAMS, "params.uri is required");
  }

  // Parse swwarm://memory/<uuid>
  const match = uri.match(/^swwarm:\/\/memory\/([0-9a-f-]{36})$/i);
  if (!match) {
    return rpcError(id, RPC_INVALID_PARAMS, `Unrecognised resource URI: ${uri}`);
  }

  const memoryId = match[1];
  const [row] = await (db as any)
    .select({ content: memoryEntries.content, companyId: memoryEntries.companyId })
    .from(memoryEntries)
    .where(eq(memoryEntries.id, memoryId))
    .limit(1);

  if (!row || row.companyId !== companyId) {
    return rpcError(id, RPC_INVALID_PARAMS, "Resource not found");
  }

  return rpcOk(id, {
    contents: [{ uri, mimeType: "text/plain", text: row.content }],
  });
}

/**
 * Dispatches a JSON-RPC request to the appropriate handler.
 * Returns a JSON-RPC response (always 200 HTTP — errors are in the response body).
 */
export async function handleJsonRpc(
  db: Db,
  companyId: string,
  body: unknown,
): Promise<JsonRpcResponse> {
  // Validate JSON-RPC envelope
  if (!body || typeof body !== "object") {
    return rpcError(null, RPC_PARSE_ERROR, "Invalid JSON-RPC request");
  }

  const req = body as Partial<JsonRpcRequest>;
  const id = req.id ?? null;

  if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return rpcError(id, RPC_PARSE_ERROR, "Invalid JSON-RPC envelope");
  }

  try {
    switch (req.method) {
      case "initialize":
        return handleInitialize(id);
      case "tools/list":
        return await handleToolsList(db, companyId, id);
      case "tools/call":
        return await handleToolsCall(db, companyId, id, req.params);
      case "resources/list":
        return await handleResourcesList(db, companyId, id);
      case "resources/read":
        return await handleResourcesRead(db, companyId, id, req.params);
      default:
        return rpcError(id, RPC_METHOD_NOT_FOUND, `Method not found: ${req.method}`);
    }
  } catch (err: any) {
    log.error({ err, method: req.method, companyId }, "mcp: unhandled error");
    return rpcError(id, RPC_INTERNAL_ERROR, err?.message ?? "Internal error");
  }
}
