/**
 * G14 — Google A2A protocol type definitions.
 * Spec: https://google.github.io/A2A (April 2025, version 1.0)
 *
 * A2A uses JSON-RPC 2.0 over HTTP POST.
 * Agent cards are served at /.well-known/agent.json (global)
 * and /a2a/:companyId/agent.json (per-company).
 */

// ── Message parts ─────────────────────────────────────────────────────────────

export interface TextPart {
  type: "text";
  text: string;
  metadata?: Record<string, unknown>;
}

export interface FilePart {
  type: "file";
  file: {
    name?: string;
    mimeType?: string;
    data?: string;   // base64-encoded bytes
    uri?: string;    // external URI (mutually exclusive with data)
  };
  metadata?: Record<string, unknown>;
}

export interface DataPart {
  type: "data";
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type Part = TextPart | FilePart | DataPart;

// ── Message ───────────────────────────────────────────────────────────────────

export interface Message {
  role: "user" | "agent";
  parts: Part[];
  metadata?: Record<string, unknown>;
}

// ── Task status ───────────────────────────────────────────────────────────────

export type TaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "failed"
  | "canceled";

export interface TaskStatus {
  state: TaskState;
  message?: Message;
  timestamp?: string; // ISO 8601
}

// ── Artifact ──────────────────────────────────────────────────────────────────

export interface Artifact {
  name?: string;
  description?: string;
  parts: Part[];
  index: number;
  append?: boolean;
  lastChunk?: boolean;
  metadata?: Record<string, unknown>;
}

// ── Task ──────────────────────────────────────────────────────────────────────

export interface A2ATask {
  id: string;
  sessionId?: string;
  status: TaskStatus;
  artifacts?: Artifact[];
  history?: Message[];
  metadata?: Record<string, unknown>;
}

// ── Agent Card ────────────────────────────────────────────────────────────────

export interface AgentSkill {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
}

export interface AgentAuthentication {
  schemes: string[];
  credentials?: string;
}

export interface AgentCard {
  name: string;
  description?: string;
  url: string;
  version: string;
  documentationUrl?: string;
  capabilities: AgentCapabilities;
  authentication: AgentAuthentication;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
}

// ── JSON-RPC 2.0 ──────────────────────────────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// A2A JSON-RPC error codes
export const A2A_ERROR = {
  TASK_NOT_FOUND:         { code: -32001, message: "Task not found" },
  TASK_NOT_CANCELABLE:    { code: -32002, message: "Task cannot be canceled" },
  PUSH_NOT_SUPPORTED:     { code: -32003, message: "Push notifications not supported" },
  UNSUPPORTED_OPERATION:  { code: -32004, message: "Unsupported operation" },
  AUTHENTICATION_REQUIRED:{ code: -32005, message: "Authentication required" },
  PARSE_ERROR:            { code: -32700, message: "Parse error" },
  INVALID_REQUEST:        { code: -32600, message: "Invalid request" },
  METHOD_NOT_FOUND:       { code: -32601, message: "Method not found" },
  INVALID_PARAMS:         { code: -32602, message: "Invalid params" },
  INTERNAL_ERROR:         { code: -32603, message: "Internal error" },
} as const;

// ── Method params / results ───────────────────────────────────────────────────

export interface TaskSendParams {
  id: string;
  sessionId?: string;
  message: Message;
  historyLength?: number;
  pushNotification?: unknown;
  metadata?: Record<string, unknown>;
}

export interface TaskGetParams {
  id: string;
  historyLength?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskCancelParams {
  id: string;
  metadata?: Record<string, unknown>;
}

// ── Issue status → A2A state mapping ─────────────────────────────────────────

export function issueStatusToA2AState(status: string): TaskState {
  switch (status) {
    case "backlog":
    case "todo":
    case "open":
      return "submitted";
    case "in_progress":
    case "in_review":
      return "working";
    case "blocked":
    case "awaiting_approval":
      return "input-required";
    case "done":
      return "completed";
    case "cancelled":
      return "canceled";
    default:
      return "submitted";
  }
}
