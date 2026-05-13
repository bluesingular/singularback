import { api } from "./client";

export interface ApiKeyStatus {
  provider: string;
  label: string;
  envVar: string;
  description: string;
  configured: boolean;
  source: "db" | "env" | null;
  updatedAt: string | null;
}

export const instanceApiKeysApi = {
  list: (): Promise<ApiKeyStatus[]> =>
    api.get("/instance/api-keys"),

  upsert: (provider: string, value: string): Promise<void> =>
    api.post("/instance/api-keys", { provider, value }),

  remove: (provider: string): Promise<void> =>
    api.delete(`/instance/api-keys/${provider}`),

  test: (provider: string): Promise<{ ok: boolean; status?: number; error?: string; note?: string }> =>
    api.post(`/instance/api-keys/${provider}/test`, {}),
};
