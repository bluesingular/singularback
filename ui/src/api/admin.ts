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

export interface EmbeddingMetric {
  companyId: string;
  companyName: string;
  embeddingScore: number;
  prevScore: number | null;
  weekStart: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

export interface SlaEvent {
  id: string;
  companyId: string;
  creditDays: number;
  reason: string;
  createdAt: string;
}

export interface ImpersonationSession {
  companyId: string;
  companyName: string;
  impersonatorId: string;
  startedAt: string;
}

export interface MasterSkill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  markdown: string;
  tier: number;
  gdprRequired: boolean;
  aiActRisk: string;
  masterVersion: string | null;
}

export interface TenantCopy {
  skillId: string;
  companyId: string;
  companyName: string;
  masterVersion: string | null;
}

export interface SkillUpdateNotification {
  id: string;
  masterSkillId: string;
  tenantSkillId: string;
  companyId: string;
  companyName: string;
  skillName: string;
  newVersion: string;
  changelog: string | null;
  status: string;
  createdAt: string;
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

  listEmbeddingMetrics(): Promise<{ metrics: EmbeddingMetric[] }> {
    return request("/admin/embedding-metrics");
  },

  getQueueStats(): Promise<QueueStats> {
    return request("/admin/queue-stats");
  },

  getSlaEvents(companyId: string): Promise<{ events: SlaEvent[]; creditDaysThisMonth: number }> {
    return request(`/admin/companies/${companyId}/sla-events`);
  },

  restartWorkers(): Promise<{ ok: boolean }> {
    return request("/admin/workers/restart", { method: "POST" });
  },

  createTenant(data: { name: string; plan?: string }): Promise<{ ok: true; data: { id: string; name: string; slug: string } }> {
    return adminApi.post("/admin/tenants", data);
  },

  updateTenant(companyId: string, data: { name?: string; status?: string }): Promise<{ ok: boolean }> {
    return adminApi.patch(`/admin/tenants/${companyId}`, data);
  },
};
