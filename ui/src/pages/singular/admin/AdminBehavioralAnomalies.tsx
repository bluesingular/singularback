/**
 * Screen B — Behavioral drift anomalies (AG-10).
 * Route: /instance/admin/anomalies
 * Admin only — never surfaced to operators.
 */

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { adminApi } from "../../../api/admin.js"

// ── Types ─────────────────────────────────────────────────────────────────────

interface BehavioralAnomaly {
  id: string
  companyId: string
  companyName: string
  skillSlug: string
  skillName: string
  agentName: string | null
  metric: string
  baselineVal: number
  currentVal: number
  deviationPct: number
  severity: "low" | "medium" | "high"
  resolved: boolean
  detectedAt: string
}

interface AnomaliesResponse {
  anomalies: BehavioralAnomaly[]
}

// ── Severity badge ─────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  low:    "bg-[#F5F5F3] text-[#6B7280]",
  medium: "bg-[#FFF8EC] text-[#C97C0A]",
  high:   "bg-[#FEF2F2] text-red-600",
}

const SEVERITY_LABELS: Record<string, string> = {
  low: "Faible", medium: "Modérée", high: "Élevée",
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low)}>
      {SEVERITY_LABELS[severity] ?? severity}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminBehavioralAnomalies() {
  const queryClient = useQueryClient()
  const [severityFilter, setSeverityFilter] = React.useState<string>("all")
  const [tenantFilter, setTenantFilter] = React.useState<string>("all")
  const [resolvedFilter, setResolvedFilter] = React.useState<"unresolved" | "resolved" | "all">("unresolved")
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const anomaliesQuery = useQuery({
    queryKey: ["admin-behavioral-anomalies"],
    queryFn: () =>
      adminApi.get<AnomaliesResponse>("/admin/behavioral-anomalies")
        .catch(() => ({ anomalies: [] as BehavioralAnomaly[] })),
    staleTime: 30_000,
  })

  const resolveMutation = useMutation({
    mutationFn: (anomalyId: string) =>
      adminApi.post(`/admin/behavioral-anomalies/${anomalyId}/resolve`),
    onMutate: (id) => setBusyId(id),
    onSettled: () => {
      setBusyId(null)
      queryClient.invalidateQueries({ queryKey: ["admin-behavioral-anomalies"] })
    },
  })

  const anomalies = anomaliesQuery.data?.anomalies ?? []

  // Unique tenants from results
  const tenants = React.useMemo(() => {
    const map = new Map<string, string>()
    anomalies.forEach(a => map.set(a.companyId, a.companyName))
    return Array.from(map.entries())
  }, [anomalies])

  const filtered = anomalies.filter(a => {
    if (severityFilter !== "all" && a.severity !== severityFilter) return false
    if (tenantFilter !== "all" && a.companyId !== tenantFilter) return false
    if (resolvedFilter === "unresolved" && a.resolved) return false
    if (resolvedFilter === "resolved" && !a.resolved) return false
    return true
  })

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-[#8A8680]" />
            <h1 className="text-2xl font-serif font-semibold text-[#0F0F0D]">Anomalies comportementales</h1>
          </div>
          <p className="text-sm text-[#8A8680]">
            Dérives détectées par rapport aux baselines — admin uniquement, non visible par les opérateurs.
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="text-sm border border-[#E8E4DC] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] bg-white"
          >
            <option value="all">Toutes sévérités</option>
            <option value="high">Élevée</option>
            <option value="medium">Modérée</option>
            <option value="low">Faible</option>
          </select>

          <select
            value={tenantFilter}
            onChange={e => setTenantFilter(e.target.value)}
            className="text-sm border border-[#E8E4DC] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] bg-white min-w-[180px]"
          >
            <option value="all">Tous les tenants</option>
            {tenants.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          <div className="flex border border-[#E8E4DC] rounded-lg overflow-hidden">
            {(["unresolved", "resolved", "all"] as const).map(v => (
              <button
                key={v}
                onClick={() => setResolvedFilter(v)}
                className={cn(
                  "px-3 py-2 text-sm transition-colors",
                  resolvedFilter === v
                    ? "bg-[#0F0F0D] text-white"
                    : "text-[#8A8680] hover:text-[#0F0F0D] hover:bg-[#F0EDE6]",
                )}
              >
                {v === "unresolved" ? "Non résolues" : v === "resolved" ? "Résolues" : "Toutes"}
              </button>
            ))}
          </div>

          {anomaliesQuery.isLoading && <Loader2 size={14} className="animate-spin text-[#8A8680]" />}
        </div>

        {/* Anomaly cards */}
        <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
          {filtered.length === 0 && !anomaliesQuery.isLoading && (
            <div className="px-5 py-12 text-center">
              <CheckCircle2 size={24} className="text-[#1A9E68] mx-auto mb-3" />
              <p className="text-sm text-[#8A8680]">
                Aucune anomalie détectée — les agents fonctionnent normalement.
              </p>
            </div>
          )}

          {filtered.map((a, i) => (
            <div
              key={a.id}
              className={cn(
                "flex items-center gap-4 px-5 py-4 border-b border-[#F0EDE6] last:border-0",
                a.resolved && "opacity-50",
              )}
            >
              {/* Left: company + skill */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-[#0F0F0D]">{a.companyName}</span>
                  <span className="text-xs text-[#8A8680]">·</span>
                  {a.agentName && (
                    <>
                      <span className="text-xs text-[#8A8680]">{a.agentName}</span>
                      <span className="text-xs text-[#8A8680]">·</span>
                    </>
                  )}
                  <span className="text-xs text-[#8A8680]">{a.skillName}</span>
                </div>
                <p className="text-xs text-[#8A8680]">
                  Métrique : <span className="text-[#0F0F0D]">{a.metric}</span>
                  {" · "}Détectée {new Date(a.detectedAt).toLocaleDateString("fr-FR")}
                </p>
              </div>

              {/* Baseline → Current */}
              <div className="flex items-center gap-2 text-sm flex-shrink-0">
                <span className="text-[#8A8680]">{a.baselineVal.toFixed(2)}</span>
                <span className="text-[#8A8680]">→</span>
                <span className={cn("font-medium", a.deviationPct < 0 ? "text-red-600" : "text-[#1A9E68]")}>
                  {a.currentVal.toFixed(2)}
                </span>
              </div>

              {/* Deviation */}
              <div className={cn(
                "w-20 text-center text-sm font-medium flex-shrink-0",
                a.deviationPct < -20 ? "text-red-600" : a.deviationPct < 0 ? "text-[#C97C0A]" : "text-[#1A9E68]",
              )}>
                {a.deviationPct > 0 ? "+" : ""}{a.deviationPct.toFixed(1)} %
              </div>

              {/* Severity */}
              <div className="flex-shrink-0">
                <SeverityBadge severity={a.severity} />
              </div>

              {/* Resolve button */}
              {!a.resolved && (
                <button
                  onClick={() => resolveMutation.mutate(a.id)}
                  disabled={busyId === a.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1A9E68] hover:bg-[#E8F7F0] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  {busyId === a.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <CheckCircle2 size={12} />
                  }
                  Résolu
                </button>
              )}
              {a.resolved && (
                <span className="text-xs text-[#8A8680] flex-shrink-0">Résolu</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
