import { api } from "./client";

export type ConfigParamType = "select" | "number" | "text" | "text_list" | "toggle";

export interface ConfigParam {
  name: string;
  type: ConfigParamType;
  label: string;
  description?: string;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
  default: string | number | boolean | string[];
}

export interface AgentConfigResponse {
  agentId: string;
  agentName: string;
  skillSlugs: string[];
  configParams: ConfigParam[];
  currentValues: Record<string, unknown>;
}

export const agentConfigApi = {
  get: (companyId: string, agentId: string) =>
    api.get<AgentConfigResponse>(`/companies/${companyId}/agents/${agentId}/config`),

  update: (companyId: string, agentId: string, values: Record<string, unknown>) =>
    api.put<{ agentId: string; runtimeConfig: Record<string, unknown> }>(
      `/companies/${companyId}/agents/${agentId}/config`,
      values,
    ),
};
