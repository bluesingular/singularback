import { request } from "./client";

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: string;
  members: number;
  activeAgents: number;
  tasksLast30d: number;
  costLast30d: number;
  tasksUsed: number;
  tasksLimit: number;
  stripeCustomerId: string | null;
}

export interface TenantDetail {
  company: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    locale: string;
    timezone: string;
    createdAt: string;
    stripeCustomerId: string | null;
    stripeSubId: string | null;
    tasksUsed: number;
    tasksLimit: number;
    tokensUsed: number;
    tokensLimit: number;
    spentCents: number;
    budgetCents: number;
  };
  members: {
    userId: string;
    role: string;
    status: string;
    email: string | null;
    name: string | null;
    joinedAt: string;
  }[];
  agents: { id: string; name: string; status: string; role: string }[];
  tasksLast30d: number;
  costLast30d: number;
  recentAudit: {
    id: string;
    actionType: string;
    actionData: unknown;
    result: string;
    createdAt: string;
  }[];
}

export interface PlatformHealth {
  tenants: number;
  tasksAllTime: number;
  costLast30Days: number;
}

export interface ImpersonationSession {
  companyId: string;
  companyName: string;
  impersonatorId: string;
  startedAt: string;
}

export const adminApi = {
  get<T = unknown>(path: string): Promise<T> {
    return request(path) as Promise<T>;
  },

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return request(path, {
      method: "POST",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }) as Promise<T>;
  },

  patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return request(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as Promise<T>;
  },

  delete<T = unknown>(path: string): Promise<T> {
    return request(path, { method: "DELETE" }) as Promise<T>;
  },

  health(): Promise<PlatformHealth> {
    return request("/admin/health");
  },

  listTenants(): Promise<{ tenants: TenantSummary[] }> {
    return request("/admin/tenants");
  },

  getTenant(companyId: string): Promise<TenantDetail> {
    return request(`/admin/tenants/${companyId}`);
  },

  startImpersonation(companyId: string): Promise<ImpersonationSession> {
    return request(`/admin/tenants/${companyId}/impersonate`, { method: "POST" });
  },

  endImpersonation(companyId: string): Promise<{ ok: boolean }> {
    return request(`/admin/tenants/${companyId}/impersonate`, { method: "DELETE" });
  },
};
