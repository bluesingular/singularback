import { api } from "./client";

export type Plan = "solo" | "growth" | "pro" | "enterprise";

export interface TenantPlan {
  id: string;
  name: string;
  plan: Plan;
  tasksUsedMonth: number;
  tasksLimitMonth: number;
  tokensUsedMonth: number;
  tokensLimitMonth: number;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
}

export interface ModelEntry {
  tier: string;
  label: string;
  model: string;
  fallback: string | null;
  gdprSafe: boolean;
  euHosted: boolean;
  maxInputTokens: number;
  maxOutputTokens: number;
  costPerMTokenEur: number;
  useCase: string;
  warning?: string;
  note?: string;
}

export const adminPlanApi = {
  getTenantPlan: (companyId: string): Promise<TenantPlan> =>
    api.get(`/admin/tenants/${companyId}/plan`),

  setPlan: (companyId: string, payload: { plan?: Plan; tasksLimitMonth?: number; tokensLimitMonth?: number }): Promise<TenantPlan> =>
    api.patch(`/admin/tenants/${companyId}/plan`, payload),

  getCheckoutUrl: (companyId: string, plan: Plan): Promise<{ url: string | null }> =>
    api.post(`/companies/${companyId}/billing/checkout`, { plan }),

  getPortalUrl: (companyId: string): Promise<{ url: string | null }> =>
    api.get(`/companies/${companyId}/billing/portal`),

  listLlmModels: (): Promise<ModelEntry[]> =>
    api.get("/instance/llm-models"),
};
