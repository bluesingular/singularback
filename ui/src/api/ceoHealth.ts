import { api } from "./client";

export interface CeoHealthScore {
  companyId:         string;
  periodLabel:       string;
  delegatedHours:    number;
  totalWorkingHours: number;
  ceoRatio:          number;
  ceoRatioPct:       number;
  trend:             number;
  taskCount:         number;
  sparkline:         { month: string; ratio: number }[];
  shareableCard:     string;
  computedAt:        string;
}

export const ceoHealthApi = {
  get: (companyId: string) =>
    api.get<{ ok: true; data: CeoHealthScore }>(`/companies/${companyId}/ceo-health`),
  history: (companyId: string) =>
    api.get<{ ok: true; data: CeoHealthScore[] }>(`/companies/${companyId}/ceo-health/history`),
};
