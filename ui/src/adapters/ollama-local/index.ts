import type { UIAdapterModule } from "../types";
import { parseOllamaStdoutLine } from "./parse-stdout";
import { OllamaConfigFields } from "./config-fields";
import { buildOllamaConfig } from "./build-config";

export const ollamaLocalUIAdapter: UIAdapterModule = {
  type: "ollama_local",
  label: "Ollama (local)",
  parseStdoutLine: parseOllamaStdoutLine,
  ConfigFields: OllamaConfigFields,
  buildAdapterConfig: buildOllamaConfig,
};
