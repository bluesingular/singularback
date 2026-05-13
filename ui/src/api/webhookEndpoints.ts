import { api } from "./client";

export type RoutingRuleOp = "eq" | "contains" | "exists";
export type RoutingActionType = "heartbeat" | "log_only";
export type WebhookSourceHint = "indeed" | "calendly" | "slack" | "github" | "stripe" | "custom";

export interface RoutingRule {
  condition?: {
    field: string;
    op: RoutingRuleOp;
    value?: string;
  };
  action: {
    type: RoutingActionType;
    agentId?: string;
  };
}

export interface WebhookEndpoint {
  id: string;
  companyId: string;
  name: string;
  secret: string | null;
  sourceHint: WebhookSourceHint;
  routingRules: RoutingRule[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const webhookEndpointsApi = {
  list: (companyId: string): Promise<WebhookEndpoint[]> =>
    api.get(`/companies/${companyId}/webhook-endpoints`),

  create: (companyId: string, payload: {
    name: string;
    secret?: string;
    sourceHint?: WebhookSourceHint;
    routingRules?: RoutingRule[];
  }): Promise<WebhookEndpoint> =>
    api.post(`/companies/${companyId}/webhook-endpoints`, payload),

  update: (companyId: string, id: string, patch: {
    name?: string;
    secret?: string | null;
    sourceHint?: WebhookSourceHint;
    routingRules?: RoutingRule[];
    isActive?: boolean;
  }): Promise<WebhookEndpoint> =>
    api.patch(`/companies/${companyId}/webhook-endpoints/${id}`, patch),

  remove: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/webhook-endpoints/${id}`),
};
