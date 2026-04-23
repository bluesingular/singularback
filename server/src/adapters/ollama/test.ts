import type { AdapterEnvironmentCheck, AdapterEnvironmentTestContext, AdapterEnvironmentTestResult } from "@paperclipai/adapter-utils";
import { asString } from "../utils.js";

export async function testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult> {
  const host = asString(ctx.config.host, "http://localhost:11434");
  const checks: AdapterEnvironmentCheck[] = [];

  try {
    const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      checks.push({
        code: "ollama_unreachable",
        level: "error",
        message: `Ollama returned HTTP ${res.status}`,
        hint: `Is Ollama running at ${host}?`,
      });
      return {
        adapterType: ctx.adapterType,
        status: "fail",
        checks,
        testedAt: new Date().toISOString(),
      };
    }

    const data = await res.json() as { models?: Array<{ name: string }> };
    const count = data.models?.length ?? 0;

    if (count === 0) {
      checks.push({
        code: "ollama_no_models",
        level: "warn",
        message: "Ollama is running but no models are pulled yet.",
        hint: "Run: ollama pull llama3.2",
      });
    } else {
      checks.push({
        code: "ollama_ok",
        level: "info",
        message: `Ollama reachable — ${count} model${count === 1 ? "" : "s"} available`,
      });
    }
  } catch {
    checks.push({
      code: "ollama_unreachable",
      level: "error",
      message: `Cannot reach Ollama at ${host}`,
      hint: "Start Ollama with: ollama serve",
    });
  }

  const hasErrors = checks.some(c => c.level === "error");
  return {
    adapterType: ctx.adapterType,
    status: hasErrors ? "fail" : checks.length > 0 ? "warn" : "pass",
    checks,
    testedAt: new Date().toISOString(),
  };
}
