import { api } from "./client";

export type GateType = "volume_limit" | "recipient_whitelist" | "budget_limit" | "content_forbidden";

export interface QualityGate {
  id: string;
  companyId: string;
  agentId: string | null;
  gateType: GateType;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export interface GateViolation {
  id: string;
  gateId: string;
  agentId: string | null;
  taskId: string | null;
  actionType: string;
  violation: string;
  resolution: string | null;
  createdAt: string;
}

export type CreateGatePayload =
  | { gateType: "volume_limit";        agentId?: string | null; config: { type: "volume_limit";        maxPerDay: number } }
  | { gateType: "recipient_whitelist"; agentId?: string | null; config: { type: "recipient_whitelist"; allowedDomains: string[] } }
  | { gateType: "budget_limit";        agentId?: string | null; config: { type: "budget_limit";        limitCents: number } }
  | { gateType: "content_forbidden";   agentId?: string | null; config: { type: "content_forbidden";   terms: string[] } };

export const qualityGatesApi = {
  list: (companyId: string): Promise<QualityGate[]> =>
    api.get(`/companies/${companyId}/quality-gates`),

  violations: (companyId: string): Promise<GateViolation[]> =>
    api.get(`/companies/${companyId}/quality-gates/violations`),

  create: (companyId: string, payload: CreateGatePayload): Promise<QualityGate> =>
    api.post(`/companies/${companyId}/quality-gates`, payload),

  update: (companyId: string, id: string, patch: { enabled?: boolean; config?: Record<string, unknown> }): Promise<QualityGate> =>
    api.patch(`/companies/${companyId}/quality-gates/${id}`, patch),

  remove: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/quality-gates/${id}`),
};
