/**
 * Gap O — Agent Fleet Registry dashboard.
 * Route: /instance/admin/fleet
 * Internal Swwarm team only — shows aggregate health across all tenants.
 * No company-level operational data exposed.
 */

import * as React from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { RefreshCw, Loader2, Activity, Users, Zap, AlertTriangle, BarChart2 } from "lucide-react"
import { adminApi } from "../../../api/admin.js"

// ── Types ─────────────────────────────────────────────────────────────────────

interface FleetSnapshot {
  total_companies:    number
  total_active_agents: number
  agents_by_status:   { active: number; paused: number; deactivated: number }
  skill_deployment_distribution: { skill_slug: string; company_count: number }[]
  model_version_distribution:    { model: string; skill_count: number }[]
  underperforming_agents:        { skill_slug: string; avg_judge_score: number; company_count: number }[]
  global_error_rate:  number
  computed_at:        string
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = "#1A9E68" }: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color }} />
        <span className="text-xs font-medium text-[#8A8680]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#0F0F0D]">{value}</p>
      {sub && <p className="text-xs text-[#8A8680]">{sub}</p>}
    </div>
  )
}

// ── Distribution row ──────────────────────────────────────────────────────────

function DistributionBar({ label, value, max, color = "#1A9E68" }: {
  label: string; value: number; max: number; color?: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[#8A8680] w-48 truncate flex-none">{label}</span>
      <div className="flex-1 bg-[#F5F5F3] rounded-full h-2">
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium text-[#0F0F0D] w-8 text-right flex-none">{value}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminFleetRegistry() {
  const snapshotQuery = useQuery<FleetSnapshot>({
    queryKey: ["admin-fleet-snapshot"],
    queryFn: () =>
      adminApi.get<{ ok: true; data: FleetSnapshot }>("/admin/fleet").then(r => r.data),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const refreshMutation = useMutation({
    mutationFn: () => adminApi.post<{ ok: true; data: FleetSnapshot }>("/admin/fleet/refresh", {}),
    onSuccess: () => snapshotQuery.refetch(),
  })

  const snap = snapshotQuery.data

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={16} className="text-[#8A8680]" />
              <h1 className="text-2xl font-serif font-semibold text-[#0F0F0D]">Fleet Registry</h1>
            </div>
            <p className="text-sm text-[#8A8680]">
              Aggregate agent health across all tenants — Gap O.
              {snap && (
                <span className="ml-2 text-[#8A8680]">
                  Last computed: {new Date(snap.computed_at).toLocaleString("fr-FR")}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-[#E8E4DC] bg-white hover:bg-[#FAFAF8] transition-colors disabled:opacity-40"
          >
            {refreshMutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <RefreshCw size={14} />
            }
            {refreshMutation.isPending ? "Computing…" : "Refresh"}
          </button>
        </div>

        {/* Loading / error states */}
        {snapshotQuery.isLoading && (
          <div className="flex items-center gap-2 text-sm text-[#8A8680]">
            <Loader2 size={14} className="animate-spin" />
            Loading fleet snapshot…
          </div>
        )}
        {snapshotQuery.isError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-600 flex-none" />
            <p className="text-sm text-amber-700">
              No fleet snapshot available yet.
              <button onClick={() => refreshMutation.mutate()} className="ml-2 underline font-medium">
                Compute now
              </button>
            </p>
          </div>
        )}

        {snap && (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard icon={Users}    label="Active tenants"      value={snap.total_companies}       color="#1A4E8C" />
              <StatCard icon={Zap}      label="Active agents"        value={snap.agents_by_status.active} color="#1A9E68" />
              <StatCard icon={Activity} label="Paused agents"        value={snap.agents_by_status.paused} color="#C97C0A" />
              <StatCard
                icon={AlertTriangle}
                label="Global error rate"
                value={`${(snap.global_error_rate * 100).toFixed(1)}%`}
                color={snap.global_error_rate > 0.1 ? "#B91C1C" : "#1A9E68"}
              />
            </div>

            {/* Skill deployment */}
            {snap.skill_deployment_distribution.length > 0 && (
              <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 size={14} className="text-[#8A8680]" />
                  <h2 className="text-sm font-semibold text-[#0F0F0D]">Skill deployment distribution</h2>
                  <span className="text-xs text-[#8A8680]">(tenants using each skill)</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {snap.skill_deployment_distribution.slice(0, 12).map((row) => (
                    <DistributionBar
                      key={row.skill_slug}
                      label={row.skill_slug}
                      value={row.company_count}
                      max={snap.skill_deployment_distribution[0]?.company_count ?? 1}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Model distribution */}
            {snap.model_version_distribution.length > 0 && (
              <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={14} className="text-[#8A8680]" />
                  <h2 className="text-sm font-semibold text-[#0F0F0D]">Model version distribution</h2>
                  <span className="text-xs text-[#8A8680]">(skills per model)</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {snap.model_version_distribution.map((row) => (
                    <DistributionBar
                      key={row.model}
                      label={row.model}
                      value={row.skill_count}
                      max={snap.model_version_distribution[0]?.skill_count ?? 1}
                      color="#1A4E8C"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Underperforming agents */}
            {snap.underperforming_agents.length > 0 && (
              <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F0EDE6] flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <h2 className="text-sm font-semibold text-[#0F0F0D]">Underperforming skills</h2>
                  <span className="text-xs text-[#8A8680]">(anonymised — avg judge &lt; 6.0)</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F0EDE6]">
                      <th className="px-5 py-2 text-left text-xs font-medium text-[#8A8680]">Skill slug</th>
                      <th className="px-5 py-2 text-right text-xs font-medium text-[#8A8680]">Avg judge score</th>
                      <th className="px-5 py-2 text-right text-xs font-medium text-[#8A8680]">Tenants affected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.underperforming_agents.map((row) => (
                      <tr key={row.skill_slug} className="border-b border-[#F0EDE6] last:border-0 hover:bg-[#FAFAF8]">
                        <td className="px-5 py-3 font-mono text-xs">{row.skill_slug}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-semibold ${row.avg_judge_score < 5 ? "text-red-600" : "text-amber-600"}`}>
                            {row.avg_judge_score.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-[#8A8680]">{row.company_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
