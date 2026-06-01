import { api } from "./client";

export interface AgingBucket {
  current:    number;
  days30:     number;
  days60:     number;
  days90plus: number;
}

export interface FinancialPulse {
  mrrEquivalent:      number | null;
  outstandingTotal:   number;
  aging:              AgingBucket;
  top5Clients:        { name: string; revenueEur: number }[];
  cashProjection:     { days30: number; days60: number; days90: number } | null;
  invoicesAtRisk:     { contactName: string; amountEur: number; daysOverdue: number }[];
  hasConnectedSource: boolean;
  computedAt:         string;
}

export const financialPulseApi = {
  get: (companyId: string) =>
    api.get<{ ok: true; data: FinancialPulse }>(`/companies/${companyId}/financial-pulse`),
};
