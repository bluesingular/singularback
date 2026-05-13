import { api } from "./client";

export type IntegrationType =
  | "gmail" | "linkedin" | "slack" | "calendly" | "notion"
  | "airtable" | "google_calendar" | "hubspot" | "custom";

export interface Integration {
  id: string;
  companyId: string;
  type: IntegrationType;
  name: string;
  status: "connected" | "disconnected" | "error";
  scopes: string[];
  config: Record<string, unknown>;
  webhookSecret: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionGrant {
  id: string;
  agentId: string;
  agentName: string;
  permissions: string[];
  grantedAt: string;
}

export interface PermissionsResponse {
  grants: PermissionGrant[];
  availablePermissions: string[];
}

export const integrationsApi = {
  list: (companyId: string): Promise<Integration[]> =>
    api.get(`/companies/${companyId}/integrations`),

  create: (companyId: string, payload: { type: IntegrationType; name: string; credentials: string; config?: Record<string, unknown>; scopes?: string[] }): Promise<Integration> =>
    api.post(`/companies/${companyId}/integrations`, payload),

  update: (companyId: string, id: string, patch: { name?: string; credentials?: string; config?: Record<string, unknown>; status?: string }): Promise<Integration> =>
    api.patch(`/companies/${companyId}/integrations/${id}`, patch),

  remove: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/integrations/${id}`),

  getPermissions: (companyId: string, id: string): Promise<PermissionsResponse> =>
    api.get(`/companies/${companyId}/integrations/${id}/permissions`),

  grantPermissions: (companyId: string, id: string, agentId: string, permissions: string[]): Promise<PermissionGrant> =>
    api.post(`/companies/${companyId}/integrations/${id}/permissions`, { agentId, permissions }),

  revokePermissions: (companyId: string, id: string, agentId: string): Promise<void> =>
    api.delete(`/companies/${companyId}/integrations/${id}/permissions/${agentId}`),
};
