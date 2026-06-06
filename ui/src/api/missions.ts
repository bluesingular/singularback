import { api } from "./client";

export interface Mission {
  id:             string;
  title:          string;
  brief:          string;
  status:         "draft" | "active" | "blocked" | "complete" | "archived";
  orchestratorId: string | null;
  createdAt:      string;
  completedAt:    string | null;
}

export interface MissionMessage {
  id:        string;
  role:      "user" | "orchestrator" | "system";
  content:   string;
  agentId:   string | null;
  createdAt: string;
}

export interface MissionDetail extends Mission {
  messages: MissionMessage[];
  tasks:    { id: string; title: string; status: string }[];
}

export const missionsApi = {
  list: (companyId: string) =>
    api.get<Mission[]>(`/companies/${companyId}/missions`),

  get: (companyId: string, missionId: string) =>
    api.get<MissionDetail>(`/companies/${companyId}/missions/${missionId}`),

  create: (companyId: string, body: { title: string; brief: string; orchestratorId?: string }) =>
    api.post<Mission>(`/companies/${companyId}/missions`, body),

  addMessage: (companyId: string, missionId: string, content: string) =>
    api.post<MissionMessage>(`/companies/${companyId}/missions/${missionId}/messages`, {
      role: "user",
      content,
    }),

  patch: (companyId: string, missionId: string, body: Partial<Pick<Mission, "status" | "title" | "brief">>) =>
    api.patch<Mission>(`/companies/${companyId}/missions/${missionId}`, body),

  getCost: (companyId: string, missionId: string) =>
    api.get<{ missionId: string; totalEur: number }>(`/companies/${companyId}/missions/${missionId}/cost`),

  recordOutcome: (companyId: string, missionId: string, outcome: "positive" | "negative" | "neutral") =>
    api.post<{ ok: boolean }>(`/companies/${companyId}/missions/${missionId}/outcome`, { outcome }),
};
