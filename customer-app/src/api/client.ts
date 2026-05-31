/**
 * API client for the Singular customer portal.
 * All requests are cookie-based (better-auth session).
 * In dev, Vite proxies /api → http://localhost:3100.
 */

const BASE = "/api/v1";

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  companyId?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (companyId) {
    headers["x-singular-company-id"] = companyId;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error((err as any).message ?? "Erreur réseau"), {
      status: res.status,
    });
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, companyId?: string) =>
    req<T>("GET", path, undefined, companyId),
  post: <T>(path: string, body?: unknown, companyId?: string) =>
    req<T>("POST", path, body, companyId),
  patch: <T>(path: string, body?: unknown, companyId?: string) =>
    req<T>("PATCH", path, body, companyId),
  delete: <T>(path: string, companyId?: string) =>
    req<T>("DELETE", path, undefined, companyId),
};

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface MeUser {
  id: string;
  email: string | null;
  name: string | null;
}

export interface MeCompany {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
}

export interface MeResponse {
  user: MeUser;
  companies: MeCompany[];
  activeCompany: {
    userId: string;
    companyId: string;
    role: string;
    plan: string;
    locale: string;
    timezone: string;
  } | null;
}

export const authApi = {
  me: () => api.get<MeResponse>("/auth/me"),
  login: (email: string, password: string) =>
    api.post<{ success: boolean }>("/auth/login", { email, password }),
  logout: () => api.post<{ success: boolean }>("/auth/logout"),
  signup: (data: {
    name: string;
    email: string;
    password: string;
    companyName: string;
  }) => api.post<{ success: boolean; company: { id: string; slug: string } }>("/auth/signup", data),
};

// ── Agents ────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  colour: string;
  status: "active" | "paused" | "deactivated" | string;
  description?: string;
  adapterType?: string;
  teamRosterVisible?: boolean;
}

export const agentsApi = {
  list: (companyId: string) =>
    api.get<Agent[]>(`/companies/${companyId}/agents`, companyId),
};

// ── Missions ──────────────────────────────────────────────────────────────────

export interface Mission {
  id: string;
  title: string;
  brief: string;
  status: "draft" | "active" | "blocked" | "complete" | "archived";
  orchestratorId?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface MissionMessage {
  id: string;
  missionId: string;
  role: "user" | "orchestrator" | "system";
  content: string;
  agentId?: string | null;
  createdAt: string;
}

export interface MissionDetail extends Mission {
  messages: MissionMessage[];
  tasks: Task[];
}

export const missionsApi = {
  list: (companyId: string) =>
    api.get<{ missions: Mission[] }>(`/companies/${companyId}/missions`, companyId),
  get: (companyId: string, missionId: string) =>
    api.get<MissionDetail>(`/companies/${companyId}/missions/${missionId}`, companyId),
  create: (companyId: string, data: { title: string; brief: string }) =>
    api.post<{ id: string }>(`/companies/${companyId}/missions`, data, companyId),
  addMessage: (companyId: string, missionId: string, content: string) =>
    api.post(`/companies/${companyId}/missions/${missionId}/messages`, { content }, companyId),
  updateStatus: (companyId: string, missionId: string, status: string) =>
    api.patch(`/companies/${companyId}/missions/${missionId}`, { status }, companyId),
  archive: (companyId: string, missionId: string) =>
    api.post(`/companies/${companyId}/missions/${missionId}/archive`, {}, companyId),
};

// ── Steer ─────────────────────────────────────────────────────────────────────

export const steerApi = {
  send: (taskId: string, instruction: string, companyId: string) =>
    api.post(`/tasks/${taskId}/steer`, { instruction }, companyId),
};

// ── Tasks / Issues ────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  status: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
}

export const tasksApi = {
  list: (companyId: string) =>
    api.get<{ issues: Task[] }>("/issues", companyId),
  get: (id: string, companyId: string) =>
    api.get<Task>(`/issues/${id}`, companyId),
};

// ── Trust ─────────────────────────────────────────────────────────────────────

export interface TrustScore {
  agentId: string;
  skillType: string;
  score: number;
  autonomyLevel: string;
  approvalStreak: number;
}

export interface TrustProposal {
  id: string;
  agentId: string;
  proposedLevel: string;
  currentLevel: string;
  evidence: string;
  createdAt: string;
}

export const trustApi = {
  scores: (companyId: string) =>
    api.get<{ scores: TrustScore[] }>("/trust/scores", companyId),
  proposals: (companyId: string) =>
    api.get<{ proposals: TrustProposal[] }>("/trust/proposals", companyId),
  approveProposal: (id: string, companyId: string) =>
    api.post(`/trust/proposals/${id}/approve`, {}, companyId),
  rejectProposal: (id: string, companyId: string) =>
    api.post(`/trust/proposals/${id}/reject`, {}, companyId),
};

// ── Intelligence cards ────────────────────────────────────────────────────────

export interface IntelCard {
  id: string;
  type: string;
  title: string;
  body: string;
  urgency: "high" | "medium" | "low";
  actionLabel?: string;
  actionUrl?: string;
  createdAt: string;
}

export const intelligenceApi = {
  cards: (companyId: string) =>
    api.get<{ cards: IntelCard[] }>("/intelligence/cards", companyId),
  dismiss: (id: string, companyId: string) =>
    api.post(`/intelligence/cards/${id}/dismiss`, {}, companyId),
};

// ── Costs ─────────────────────────────────────────────────────────────────────

export interface CostSummary {
  tasksThisMonth: number;
  tasksLimit: number;
  costUsd: number;
  translation?: string;
}

export const costsApi = {
  summary: (companyId: string) =>
    api.get<CostSummary>("/costs/summary", companyId),
};

// ── Approvals ─────────────────────────────────────────────────────────────────

export interface Approval {
  id: string;
  taskId: string;
  taskTitle: string;
  agentId: string;
  agentName: string;
  actionType: string;
  description: string;
  createdAt: string;
}

export const approvalsApi = {
  pending: (companyId: string) =>
    api.get<{ approvals: Approval[] }>("/approvals/pending", companyId),
  approve: (id: string, companyId: string) =>
    api.post(`/approvals/${id}/approve`, {}, companyId),
  reject: (id: string, companyId: string) =>
    api.post(`/approvals/${id}/reject`, {}, companyId),
};
