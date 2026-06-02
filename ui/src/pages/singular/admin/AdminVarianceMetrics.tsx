/**
 * Screen C — Non-determinism / variance metrics (Gap A).
 * Route: /instance/admin/variance
 * Admin only — never surfaced to operators.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Activity, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { adminApi } from "../../../api/admin.js"

// ── Types ─────────────────────────────────────────────────────────────────────

interface VarianceRow {
  id: string
  companyId: string
  companyName: string
  skillSlug: string
  skillName: string
  meanScore: number
  stdDev: number
  varianceFlag: boolean
  recentScores: number[]   // up to 10
  computedAt: string
}

interface VarianceResponse {
  rows: VarianceRow[]
}

// ── Dot plot (10 dots, no lib) ────────────────────────────────────────────────

function DotPlot({ scores }: { scores: number[] }) {
  if (!scores || scores.length === 0) return <p className="text-xs text-[#8A8680]">Aucune donnée.</p>

  const w = 320
  const h = 60
  const min = 0
  const max = 10
  const range = max - min

  return (
    <svg width={w} height={h + 20} className="overflow-visible">
      {/* Axis line */}
      <line x1={0} y1={h} x2={w} y2={h} stroke="#E8E4DC" strokeWidth={1} />
      {/* Tick labels */}
      {[0, 5, 10].map(v => {
        const x = (v / range) * w
        return (
          <g key={v}>
            <line x1={x} y1={h} x2={x} y2={h + 4} stroke="#8A8680" strokeWidth={1} />
            <text x={x} y={h + 14} textAnchor="middle" fontSize={9} fill="#8A8680">{v}</text>
          </g>
        )
      })}
      {/* Dots */}
      {scores.map((s, i) => {
        const x = (s / range) * w
        const jitter = (i % 3 - 1) * 6
        const cy = h / 2 + jitter
        const color = s >= 7.5 ? "#1A9E68" : s >= 6 ? "#C97C0A" : "#EF4444"
        return (
          <circle key={i} cx={x} cy={cy} r={5} fill={color} fillOpacity={0.8} />
        )
      })}
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: "4 dernières semaines", value: 4 },
  { label: "8 semaines",           value: 8 },
  { label: "12 semaines",          value: 12 },
]

export function AdminVarianceMetrics() {
  const [weeks, setWeeks] = React.useState(4)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const query = useQuery({
    queryKey: ["admin-variance-metrics", weeks],
    queryFn: () =>
      adminApi.get<VarianceResponse>(`/admin/variance-metrics?weeks=${weeks}`)
        .catch(() => ({ rows: [] as VarianceRow[] })),
    staleTime: 60_000,
  })

  const rows = query.data?.rows ?? []

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={16} className="text-[#8A8680]" />
              <h1 className="text-2xl font-serif font-semibold text-[#0F0F0D]">Variance des scores</h1>
            </div>
            <p className="text-sm text-[#8A8680]">
              Variance par compétence et par tenant — admin uniquement, non visible par les opérateurs.
            </p>
          </div>

          <div className="flex-shrink-0">
            <select
              value={weeks}
              onChange={e => setWeeks(Number(e.target.value))}
              className="text-sm border border-[#E8E4DC] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] bg-white"
            >
              {PERIOD_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
          {/* Header row */}
          <div className="flex items-center gap-4 px-5 py-3 bg-[#FAFAF8] border-b border-[#E8E4DC]">
            <div className="flex-1 text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Tenant</div>
            <div className="w-40 text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Compétence</div>
            <div className="w-20 text-center text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Moyenne</div>
            <div className="w-20 text-center text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Écart-type</div>
            <div className="w-32 text-center text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Variance</div>
            <div className="w-28 text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Calculé le</div>
          </div>

          {query.isLoading && (
            <div className="flex items-center gap-2 px-5 py-6 text-sm text-[#8A8680]">
              <Loader2 size={14} className="animate-spin" /> Chargement…
            </div>
          )}

          {rows.length === 0 && !query.isLoading && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-[#8A8680]">
                Aucune donnée de variance disponible pour cette période.
                Les métriques sont calculées hebdomadairement après 30 tâches minimum par compétence.
              </p>
            </div>
          )}

          {rows.map(row => (
            <React.Fragment key={row.id}>
              <button
                onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                className="w-full flex items-center gap-4 px-5 py-3.5 border-b border-[#F0EDE6] hover:bg-[#FAFAF8] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F0F0D] truncate">{row.companyName}</p>
                </div>

                <div className="w-40 text-sm text-[#0F0F0D] truncate">{row.skillName}</div>

                <div className="w-20 text-center text-sm text-[#0F0F0D]">
                  {row.meanScore.toFixed(2)}
                </div>

                <div className={cn(
                  "w-20 text-center text-sm font-medium",
                  row.varianceFlag ? "text-red-600" : "text-[#1A9E68]",
                )}>
                  {row.stdDev.toFixed(2)}
                </div>

                <div className="w-32 flex justify-center">
                  {row.varianceFlag ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-[#FEF2F2] px-2 py-0.5 rounded-full">
                      <Activity size={11} />
                      Haute variance
                    </span>
                  ) : (
                    <span className="text-xs text-[#1A9E68]">Normale</span>
                  )}
                </div>

                <div className="w-28 text-xs text-[#8A8680]">
                  {new Date(row.computedAt).toLocaleDateString("fr-FR")}
                </div>
              </button>

              {expandedId === row.id && (
                <div className="px-5 py-5 bg-[#FAFAF8] border-b border-[#F0EDE6]">
                  <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wider mb-3">
                    10 derniers scores du juge — {row.skillName}
                  </p>
                  <DotPlot scores={row.recentScores} />
                  <p className="text-xs text-[#8A8680] mt-2">
                    Seuil de haute variance : écart-type &gt; 1.2.
                    {row.varianceFlag
                      ? " Ce skill présente une variance anormalement élevée — revue recommandée."
                      : " Ce skill est stable."}
                  </p>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
