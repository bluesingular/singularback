import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";
import { listOllamaModels } from "./models.js";
export const ollamaAdapter = {
    type: "ollama_local",
    execute,
    testEnvironment,
    models: [],
    listModels: listOllamaModels,
    agentConfigurationDoc: `# ollama_local agent configuration

Adapter: ollama_local

Runs a local Ollama model. Requires Ollama to be installed and running (ollama serve).

Core fields:
- host (string, optional): Ollama base URL, default "http://localhost:11434"
- model (string, required): model name matching what you have pulled locally — run "ollama list" to see available models
- timeoutSec (number, optional): request timeout in seconds, default 300
- options (object, optional): Ollama model options (temperature, top_p, num_ctx, etc.)

Examples:
  model: gemma4:latest
  model: mistral
  model: qwen2.5-coder:7b
  model: deepseek-r1:14b
  options:
    temperature: 0.7
    num_ctx: 8192
`,
};
//# sourceMappingURL=index.js.map