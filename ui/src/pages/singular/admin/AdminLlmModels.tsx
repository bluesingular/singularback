import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { adminPlanApi, type ModelEntry } from "@/api/adminPlan"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const TIER_COLORS: Record<string, string> = {
  T0:              "bg-[#F0EDE6] text-[#8A8680]",
  T1_FR_GDPR:      "bg-[#E6F4ED] text-[#1A9E68]",
  T1_EN:           "bg-[#FEF3C7] text-[#C97C0A]",
  T2_SPEED:        "bg-[#EDE9FE] text-[#7C3AED]",
  T2_QUALITY_GDPR: "bg-[#E6F4ED] text-[#1A9E68]",
  T3:              "bg-[#FEE2E2] text-[#DC2626]",
}

function GdprBadge({ safe }: { safe: boolean }) {
  return safe ? (
    <span className="flex items-center gap-1 text-xs text-[#1A9E68]">
      <CheckCircle2 size={12} /> GDPR
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-[#C97C0A]">
      <XCircle size={12} /> non-GDPR
    </span>
  )
}

function EuBadge({ hosted }: { hosted: boolean }) {
  return hosted ? (
    <span className="flex items-center gap-1 text-xs text-[#1A4E8C]">
      <CheckCircle2 size={12} /> EU
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-[#8A8680]">
      <XCircle size={12} /> hors EU
    </span>
  )
}

function ModelCard({ m }: { m: ModelEntry }) {
  return (
    <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-mono px-2 py-0.5 rounded-lg font-semibold", TIER_COLORS[m.tier] ?? "bg-[#F0EDE6] text-[#8A8680]")}>
              {m.tier}
            </span>
            <span className="font-semibold text-[#0F0F0D] text-sm">{m.label}</span>
          </div>
          <code className="text-xs text-[#8A8680] font-mono">{m.model}</code>
          {m.fallback && (
            <span className="text-xs text-[#8A8680]">
              Fallback: <code className="font-mono">{m.fallback}</code>
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-[#0F0F0D] whitespace-nowrap">
          {m.costPerMTokenEur.toFixed(2)} €/M tok
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <GdprBadge safe={m.gdprSafe} />
        <EuBadge hosted={m.euHosted} />
        <span className="text-xs text-[#8A8680]">in: {(m.maxInputTokens / 1000).toFixed(0)}k</span>
        <span className="text-xs text-[#8A8680]">out: {(m.maxOutputTokens / 1000).toFixed(0)}k</span>
      </div>

      <p className="text-xs text-[#8A8680]">{m.useCase}</p>

      {m.warning && (
        <div className="flex items-start gap-2 bg-[#FEF3C7] text-[#C97C0A] rounded-xl px-3 py-2 text-xs">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {m.warning}
        </div>
      )}
      {m.note && (
        <p className="text-xs text-[#8A8680] italic">{m.note}</p>
      )}
    </div>
  )
}

export function AdminLlmModels() {
  const { data: models, isLoading } = useQuery({
    queryKey: ["instance", "llm-models"],
    queryFn: () => adminPlanApi.listLlmModels(),
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-serif text-[#0F0F0D]">Modèles LLM</h1>
          <p className="text-sm text-[#8A8680] mt-1">Registre des modèles disponibles et leurs caractéristiques GDPR</p>
        </div>

        {isLoading && (
          <div className="text-sm text-[#8A8680]">Chargement…</div>
        )}

        {models && (
          <>
            <div className="mb-4 flex items-center gap-4 text-xs text-[#8A8680]">
              <span>{models.length} modèles</span>
              <span>·</span>
              <span>{models.filter(m => m.gdprSafe).length} GDPR-safe</span>
              <span>·</span>
              <span>{models.filter(m => m.euHosted).length} hébergés EU</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map((m) => (
                <ModelCard key={m.tier} m={m} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
