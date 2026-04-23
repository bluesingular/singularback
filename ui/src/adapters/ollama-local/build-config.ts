import type { CreateConfigValues } from "../../components/AgentConfigForm";

export function buildOllamaConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  const v_any = v as any;
  if (v_any.host) ac.host = v_any.host;
  if (v_any.model) ac.model = v_any.model;
  return ac;
}
