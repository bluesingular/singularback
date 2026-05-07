import * as React from "react"
import { useState, useEffect } from "react"
import { ArrowLeft, Save, CheckCircle } from "lucide-react"
import { useParams, useNavigate } from "@/lib/router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useCompany } from "../../context/CompanyContext"
import { agentsApi } from "@/api/agents"
import { agentConfigApi, type ConfigParam } from "@/api/agentConfig"
import { Button } from "@/components/ui/button"
import { queryKeys } from "@/lib/queryKeys"
import { cn } from "@/lib/utils"

// ── Field renderers ───────────────────────────────────────────────────────────

function SelectField({
  param,
  value,
  onChange,
}: {
  param: ConfigParam
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30"
    >
      {(param.options ?? []).map((opt) => (
        <option key={opt} value={opt}>
          {opt.charAt(0).toUpperCase() + opt.slice(1)}
        </option>
      ))}
    </select>
  )
}

function NumberField({
  param,
  value,
  onChange,
}: {
  param: ConfigParam
  value: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="number"
      min={param.min}
      max={param.max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-32 rounded-lg border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30"
    />
  )
}

function TextField({
  param,
  value,
  onChange,
}: {
  param: ConfigParam
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={param.placeholder ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30"
    />
  )
}

function TextListField({
  param,
  value,
  onChange,
}: {
  param: ConfigParam
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [raw, setRaw] = useState(value.join(", "))

  function handleBlur() {
    const parsed = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    onChange(parsed)
    setRaw(parsed.join(", "))
  }

  return (
    <input
      type="text"
      value={raw}
      placeholder={param.placeholder ?? "valeur1, valeur2, …"}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={handleBlur}
      className="w-full rounded-lg border border-[#E8E4DC] bg-white px-3 py-2 text-sm text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30"
    />
  )
}

function ToggleField({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30",
        value ? "bg-[#1A9E68]" : "bg-[#E8E4DC]",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          value ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  )
}

function ParamField({
  param,
  value,
  onChange,
}: {
  param: ConfigParam
  value: unknown
  onChange: (v: unknown) => void
}) {
  switch (param.type) {
    case "select":
      return (
        <SelectField
          param={param}
          value={String(value ?? param.default)}
          onChange={onChange}
        />
      )
    case "number":
      return (
        <NumberField
          param={param}
          value={Number(value ?? param.default)}
          onChange={onChange}
        />
      )
    case "text":
      return (
        <TextField
          param={param}
          value={String(value ?? param.default ?? "")}
          onChange={onChange}
        />
      )
    case "text_list":
      return (
        <TextListField
          param={param}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
        />
      )
    case "toggle":
      return (
        <ToggleField
          value={Boolean(value ?? param.default)}
          onChange={onChange}
        />
      )
    default:
      return null
  }
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function ConfigAgent() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { selectedCompanyId } = useCompany()
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Load agent (for name/id)
  const { data: agent } = useQuery({
    queryKey: [...queryKeys.agents.list(selectedCompanyId!), slug],
    queryFn: () => agentsApi.get(slug!, selectedCompanyId!),
    enabled: !!selectedCompanyId && !!slug,
  })

  // Load config_params + current values
  const { data: config, isLoading } = useQuery({
    queryKey: ["agent-config", selectedCompanyId, agent?.id],
    queryFn: () => agentConfigApi.get(selectedCompanyId!, agent!.id),
    enabled: !!selectedCompanyId && !!agent?.id,
  })

  // Seed local state when config loads
  useEffect(() => {
    if (config?.currentValues) {
      setValues(config.currentValues)
    }
  }, [config])

  const saveMutation = useMutation({
    mutationFn: () => agentConfigApi.update(selectedCompanyId!, agent!.id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-config", selectedCompanyId, agent?.id] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      setValidationErrors([])
    },
    onError: (err: any) => {
      const errors: string[] = err?.errors ?? [err?.message ?? "Erreur inconnue"]
      setValidationErrors(errors)
    },
  })

  function handleChange(name: string, val: unknown) {
    setValues((prev) => ({ ...prev, [name]: val }))
    setSaved(false)
  }

  if (isLoading || !config) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasParams = config.configParams.length > 0

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors w-fit"
        >
          <ArrowLeft size={14} />
          Retour à la fiche
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">
              Configurer {config.agentName}
            </h1>
            <p className="text-sm text-[#8A8680] mt-1">
              Ces réglages s'appliquent immédiatement aux prochaines tâches.
            </p>
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || saved}
            className={cn(
              "gap-1.5 text-sm flex-shrink-0",
              saved
                ? "bg-[#1A9E68]/10 text-[#1A9E68] border border-[#1A9E68]/30"
                : "bg-[#1A9E68] text-white hover:bg-[#158A58]",
            )}
          >
            {saved ? (
              <>
                <CheckCircle size={14} />
                Enregistré
              </>
            ) : (
              <>
                <Save size={14} />
                Enregistrer
              </>
            )}
          </Button>
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700 mb-1">Valeurs invalides :</p>
            <ul className="list-disc list-inside text-sm text-red-600 space-y-0.5">
              {validationErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Params */}
        {!hasParams ? (
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-8 text-center">
            <p className="text-sm text-[#8A8680]">
              Cet agent n'a pas encore de paramètres configurables.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm divide-y divide-[#F0EDE6]">
            {config.configParams.map((param) => (
              <div key={param.name} className="p-5 flex items-start gap-4">
                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-[#0F0F0D] mb-0.5">
                    {param.label}
                  </label>
                  {param.description && (
                    <p className="text-xs text-[#8A8680] leading-relaxed">
                      {param.description}
                    </p>
                  )}
                </div>

                {/* Field — right-aligned for toggle/number, full-width below for text */}
                <div
                  className={cn(
                    param.type === "toggle" || param.type === "number"
                      ? "flex-shrink-0"
                      : "w-full max-w-xs flex-shrink-0",
                  )}
                >
                  <ParamField
                    param={param}
                    value={values[param.name]}
                    onChange={(v) => handleChange(param.name, v)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Skills info */}
        {config.skillSlugs.length > 0 && (
          <div className="rounded-xl bg-[#F0EDE6] px-4 py-3">
            <p className="text-xs text-[#8A8680]">
              <span className="font-medium text-[#4B4846]">Compétences concernées :</span>{" "}
              {config.skillSlugs.join(", ")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
