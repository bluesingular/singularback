import { api } from "./client";

export interface McpKey {
  id:         string;
  name:       string;
  lastUsedAt: string | null;
  revokedAt:  string | null;
  createdAt:  string;
}

export interface CreatedMcpKey {
  id:        string;
  name:      string;
  key:       string; // raw key — shown once only
  createdAt: string;
}

export const mcpKeysApi = {
  list: (companyId: string): Promise<{ keys: McpKey[] }> =>
    api.get(`/companies/${companyId}/mcp/keys`),

  create: (companyId: string, name: string): Promise<CreatedMcpKey> =>
    api.post(`/companies/${companyId}/mcp/keys`, { name }),

  revoke: (companyId: string, keyId: string): Promise<{ ok: boolean }> =>
    api.delete(`/companies/${companyId}/mcp/keys/${keyId}`),
};
