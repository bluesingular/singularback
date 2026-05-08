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

  // ── OpenAPI spec ───────────────────────────────────────────────────────────

  getOpenApiSpec(): Promise<unknown> {
    return this.request("GET", "/openapi.json");
  }
}
