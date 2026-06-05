import { api } from "./client";

export interface AwayStatus {
  away:   boolean;
  period: { startsAt: string; endsAt: string } | null;
}

export const awayModeApi = {
  get: (companyId: string): Promise<AwayStatus & { ok: boolean }> =>
    api.get(`/companies/${companyId}/away-mode`),

  set: (companyId: string, startsAt: string, endsAt: string): Promise<{ ok: boolean; id: string }> =>
    api.post(`/companies/${companyId}/away-mode`, { startsAt, endsAt }),

  cancel: (companyId: string): Promise<{ ok: boolean }> =>
    api.delete(`/companies/${companyId}/away-mode`),

  briefing: (companyId: string): Promise<{ ok: boolean; briefing: string | null }> =>
    api.get(`/companies/${companyId}/away-mode/briefing`),
};
