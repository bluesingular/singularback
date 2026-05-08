/**
 * G14 — A2A JSON-RPC handler + Agent Card builder.
 *
 * Implements Google A2A protocol (April 2025 spec, version 1.0).
 * Maps A2A tasks onto Swwarm issues; reuses public_api_keys for auth.
 *
 * Supported methods:
 *   tasks/send   — create or continue a task (maps to issue insert/update)
 *   tasks/get    — get task status (maps to issue select)
 *   tasks/cancel — cancel a task (sets issue status = cancelled)
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, issues } from "@paperclipai/db";
import {
  A2A_ERROR,
  issueStatusToA2AState,
  type A2ATask,
  type AgentCard,
  type AgentSkill,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type Message,
  type TaskCancelParams,
  type TaskGetParams,
  type TaskSendParams,
} from "./types.js";

export const A2A_PROTOCOL_VERSION = "1.0";

// ── Agent Card ────────────────────────────────────────────────────────────────

export async function buildAgentCard(
  db: Db,
  companyId: string,
  baseUrl: string,
): Promise<AgentCard> {
  const agentRows = await (db as any)
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(and(eq(agents.companyId, companyId), eq(agents.status, "idle")));

  const skills: AgentSkill[] = agentRows.map((a: { id: string; name: string }) => ({
    id: a.id,
    name: a.name,
    description: `Tasks handled by ${a.name}`,
    tags: ["ai-agent"],
    inputModes: ["text/plain"],
    outputModes: ["text/plain"],
  }));

  return {
    name: "Swwarm AI Platform",
    description: "AI agent platform for SMBs — delegate tasks to your AI team via A2A",
    url: `${baseUrl}/a2a/${companyId}`,
    version: A2A_PROTOCOL_VERSION,
    documentationUrl: "https://docs.swwarm.com/a2a",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    authentication: { schemes: ["Bearer"] },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills,
  };
}

// ── Task helpers ──────────────────────────────────────────────────────────────

function extractTextFromMessage(message: Message): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as any).text as string)
    .join("\n");
}

function issueToA2ATask(row: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: Date;
}): A2ATask {
  const state = issueStatusToA2AState(row.status);
  const agentMessage: Message | undefined =
    row.description
      ? {
          role: "agent",
          parts: [{ type: "text", text: row.description }],
        }
      : undefined;

  return {
    id: row.id,
    status: {
      state,
      timestamp: row.createdAt.toISOString(),
      ...(agentMessage && state === "completed" ? { message: agentMessage } : {}),
    },
    ...(agentMessage
      ? {
          artifacts: [
            {
              index: 0,
              parts: [{ type: "text", text: row.description! }],
              lastChunk: true,
            },
          ],
        }
      : {}),
  };
}

// ── Method handlers ───────────────────────────────────────────────────────────

async function handleTasksSend(
  db: Db,
  companyId: string,
  params: TaskSendParams,
): Promise<A2ATask> {
  const { id, message, sessionId } = params;

  if (!id || typeof id !== "string") {
    throw { ...A2A_ERROR.INVALID_PARAMS, data: "id is required" };
  }
  if (!message?.parts?.length) {
    throw { ...A2A_ERROR.INVALID_PARAMS, data: "message.parts is required" };
  }

  const text = extractTextFromMessage(message);
  if (!text.trim()) {
    throw { ...A2A_ERROR.INVALID_PARAMS, data: "message must contain at least one text part" };
  }

  // Check if task already exists for this company
  const [existing] = await (db as any)
    .select({ id: issues.id, status: issues.status })
    .from(issues)
    .where(and(eq(issues.id, id), eq(issues.companyId, companyId)));

  if (existing) {
    // Continue existing task — append message to description
    const [updated] = await (db as any)
      .update(issues)
      .set({ description: text })
      .where(and(eq(issues.id, id), eq(issues.companyId, companyId)))
      .returning({
        id: issues.id,
        title: issues.title,
        description: issues.description,
        status: issues.status,
        createdAt: issues.createdAt,
      });
    return issueToA2ATask(updated);
  }

  // Create new task
  const taskId = id || randomUUID();
  const [created] = await (db as any)
    .insert(issues)
    .values({
      id: taskId,
      companyId,
      title: text.slice(0, 500),
      description: text,
      status: "todo",
      originKind: "a2a",
      ...(sessionId ? { originId: sessionId } : {}),
    })
    .returning({
      id: issues.id,
      title: issues.title,
      description: issues.description,
      status: issues.status,
      createdAt: issues.createdAt,
    });

  return issueToA2ATask(created);
}

async function handleTasksGet(
  db: Db,
  companyId: string,
  params: TaskGetParams,
): Promise<A2ATask> {
  const { id } = params;
  if (!id || typeof id !== "string") {
    throw { ...A2A_ERROR.INVALID_PARAMS, data: "id is required" };
  }

  const [row] = await (db as any)
    .select({
      id: issues.id,
      title: issues.title,
      description: issues.description,
      status: issues.status,
      createdAt: issues.createdAt,
    })
    .from(issues)
    .where(and(eq(issues.id, id), eq(issues.companyId, companyId)));

  if (!row) throw A2A_ERROR.TASK_NOT_FOUND;
  return issueToA2ATask(row);
}

async function handleTasksCancel(
  db: Db,
  companyId: string,
  params: TaskCancelParams,
): Promise<A2ATask> {
  const { id } = params;
  if (!id || typeof id !== "string") {
    throw { ...A2A_ERROR.INVALID_PARAMS, data: "id is required" };
  }

  // Only cancelable if not already terminal
  const [existing] = await (db as any)
    .select({ id: issues.id, status: issues.status })
    .from(issues)
    .where(and(eq(issues.id, id), eq(issues.companyId, companyId)));

  if (!existing) throw A2A_ERROR.TASK_NOT_FOUND;

  if (existing.status === "done" || existing.status === "cancelled") {
    throw A2A_ERROR.TASK_NOT_CANCELABLE;
  }

  const [updated] = await (db as any)
    .update(issues)
    .set({ status: "cancelled" })
    .where(and(eq(issues.id, id), eq(issues.companyId, companyId)))
    .returning({
      id: issues.id,
      title: issues.title,
      description: issues.description,
      status: issues.status,
      createdAt: issues.createdAt,
    });

  return issueToA2ATask(updated);
}

// ── JSON-RPC dispatcher ───────────────────────────────────────────────────────

export async function handleA2ARequest(
  db: Db,
  companyId: string,
  body: unknown,
): Promise<JsonRpcResponse> {
  const req = body as JsonRpcRequest;
  const id = req?.id ?? null;

  const errResponse = (err: { code: number; message: string; data?: unknown }): JsonRpcResponse => ({
    jsonrpc: "2.0",
    id,
    error: err,
  });

  if (!req || req.jsonrpc !== "2.0" || !req.method) {
    return errResponse(A2A_ERROR.INVALID_REQUEST);
  }

  try {
    let result: unknown;

    switch (req.method) {
      case "tasks/send":
        result = await handleTasksSend(db, companyId, req.params as TaskSendParams);
        break;
      case "tasks/get":
        result = await handleTasksGet(db, companyId, req.params as TaskGetParams);
        break;
      case "tasks/cancel":
        result = await handleTasksCancel(db, companyId, req.params as TaskCancelParams);
        break;
      default:
        return errResponse(A2A_ERROR.METHOD_NOT_FOUND);
    }

    return { jsonrpc: "2.0", id, result };
  } catch (err: any) {
    if (err?.code && err?.message) {
      return errResponse(err);
    }
    return errResponse({ ...A2A_ERROR.INTERNAL_ERROR, data: String(err?.message ?? err) });
  }
}
