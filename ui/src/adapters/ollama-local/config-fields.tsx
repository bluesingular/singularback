import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput, help } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const selectClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-background outline-none text-sm font-mono text-foreground";

export function OllamaConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  models,
}: AdapterConfigFieldsProps) {
  const currentModel = isCreate
    ? ((values as any)?.model ?? "")
    : eff("adapterConfig", "model", String(config.model ?? ""));

  return (
    <>
      <Field label="Ollama host" hint="URL where Ollama is running. Default: http://localhost:11434">
        <DraftInput
          value={
            isCreate
              ? ((values as any)?.host ?? "")
              : eff("adapterConfig", "host", String(config.host ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ ...(values as any), host: v || undefined })
              : mark("adapterConfig", "host", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="http://localhost:11434"
        />
      </Field>
      <Field label="Model" hint="Ollama model to use. Pull models with: ollama pull <name>">
        {models.length > 0 ? (
          <select
            value={currentModel}
            onChange={(e) =>
              isCreate
                ? set!({ ...(values as any), model: e.target.value || undefined })
                : mark("adapterConfig", "model", e.target.value || undefined)
            }
            className={selectClass}
          >
            <option value="">Select a model…</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        ) : (
          <DraftInput
            value={currentModel}
            onCommit={(v) =>
              isCreate
                ? set!({ model: v || undefined })
                : mark("adapterConfig", "model", v || undefined)
            }
            immediate
            className={inputClass}
            placeholder="llama3.2"
          />
        )}
      </Field>
    </>
  );
}
