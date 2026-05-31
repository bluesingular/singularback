/**
 * @swwarm/sdk — TypeScript client for the Swwarm Public API.
 *
 * Usage:
 *   import { SwwarmClient } from "@swwarm/sdk";
 *   const client = new SwwarmClient({ apiKey: "spk_...", baseUrl: "https://app.swwarm.com" });
 *   const { agents } = await client.listAgents();
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SwwarmClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  status: "open" | "in_progress" | "blocked" | "awaiting_approval" | "done" | "cancelled";
  agentId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateTaskParams {
  title: string;
  description?: string;
  agentId?: string;
}

export interface ListTasksParams {
  status?: Task["status"];
  agentId?: string;
  limit?: number;
  offset?: number;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface CreateWebhookParams {
  url: string;
  events: string[];
}

export interface Mission {
  id:          string;
  title:       string;
  status:      "draft" | "active" | "blocked" | "complete" | "archived";
  createdAt:   string;
  completedAt: string | null;
}

export interface CreateMissionParams {
  title: string;
  brief?: string;
}

export interface ListMissionsParams {
  limit?:  number;
  offset?: number;
}

export interface ApiError extends Error {
  status: number;
  body: unknown;
}

// ── Error class ───────────────────────────────────────────────────────────────

export class SwwarmApiError extends Error implements ApiError {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "SwwarmApiError";
  }
}

// ── Client ────────────────────────────────────────────────────────────────────

export class SwwarmClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: SwwarmClientOptions) {
    if (!opts.apiKey) throw new Error("apiKey is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://app.swwarm.com").replace(/\/$/, "");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({ error: res.statusText }));

    if (!res.ok) {
      throw new SwwarmApiError(
        res.status,
        data,
        (data as any)?.error ?? `HTTP ${res.status}`,
      );
    }

    return data as T;
  }

  // ── Agents ─────────────────────────────────────────────────────────────────

  listAgents(): Promise<{ agents: Agent[] }> {
    return this.request("GET", "/agents");
  }

  getAgent(id: string): Promise<Agent> {
    return this.request("GET", `/agents/${encodeURIComponent(id)}`);
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  listTasks(params: ListTasksParams = {}): Promise<{ tasks: Task[]; total: number }> {
    const qs = new URLSearchParams();
    if (params.status)  qs.set("status",  params.status);
    if (params.agentId) qs.set("agentId", params.agentId);
    if (params.limit  !== undefined) qs.set("limit",  String(params.limit));
    if (params.offset !== undefined) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return this.request("GET", `/tasks${query ? `?${query}` : ""}`);
  }

  getTask(id: string): Promise<Task> {
    return this.request("GET", `/tasks/${encodeURIComponent(id)}`);
  }

  createTask(params: CreateTaskParams): Promise<Task> {
    return this.request("POST", "/tasks", params);
  }

  // ── Webhooks ───────────────────────────────────────────────────────────────

  listWebhookSubscriptions(): Promise<{ subscriptions: WebhookSubscription[] }> {
    return this.request("GET", "/webhooks/subscriptions");
  }

  createWebhookSubscription(params: CreateWebhookParams): Promise<WebhookSubscription> {
    return this.request("POST", "/webhooks/subscriptions", params);
  }

  deleteWebhookSubscription(id: string): Promise<{ ok: boolean; id: string }> {
    return this.request("DELETE", `/webhooks/subscriptions/${encodeURIComponent(id)}`);
  }

  // ── Missions ───────────────────────────────────────────────────────────────

  listMissions(params: ListMissionsParams = {}): Promise<{ missions: Mission[]; limit: number; offset: number }> {
    const qs = new URLSearchParams();
    if (params.limit  !== undefined) qs.set("limit",  String(params.limit));
    if (params.offset !== undefined) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return this.request("GET", `/missions${query ? `?${query}` : ""}`);
  }

  getMission(id: string): Promise<{ ok: boolean; mission: Mission }> {
    return this.request("GET", `/missions/${encodeURIComponent(id)}`);
  }

  createMission(params: CreateMissionParams): Promise<{ ok: boolean; mission: Mission }> {
    return this.request("POST", "/missions", params);
  }

  // ── OpenAPI spec ───────────────────────────────────────────────────────────

  getOpenApiSpec(): Promise<unknown> {
    return this.request("GET", "/openapi.json");
  }
}

// ── Webhook verification helper ───────────────────────────────────────────────

/**
 * Verify an inbound Swwarm webhook signature (Node.js environments).
 *
 * @example
 * import { verifyWebhookSignature } from "@swwarm/sdk";
 *
 * app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
 *   const valid = verifyWebhookSignature(
 *     req.body.toString(),
 *     req.headers["x-swwarm-signature"] as string,
 *     process.env.WEBHOOK_SECRET!,
 *   );
 *   if (!valid) return res.status(401).send("Invalid signature");
 *   // process req.body...
 * });
 *
 * Note: requires Node.js 18+ (uses built-in crypto module dynamically).
 */
export async function verifyWebhookSignature(
  rawBody:   string,
  signature: string,
  secret:    string,
): Promise<boolean> {
  const received = signature.startsWith("sha256=") ? signature.slice(7) : signature;

  // Use Web Crypto API for universal compatibility (Node 18+ / browser)
  const enc     = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(rawBody);

  const key = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, msgData);
  const expected  = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < received.length; i++) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
