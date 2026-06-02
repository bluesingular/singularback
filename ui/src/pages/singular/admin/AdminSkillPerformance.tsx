/**
 * Screen A — Skill performance metrics per tenant (AG-10 / Gap A).
 * Route: /instance/admin/skill-performance
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, Loader2, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { adminApi } from "../../../api/admin.js"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SkillPerf {
  skillId: string
  skillSlug: string
  skillName: string
  avgJudgeScore30d: number | null
  passRate: number | null
  approvalRate: number | null
  tasksLast30d: number
  trend: "up" | "down" | "stable" | null
  judgeHistory: number[]
  topFailureReasons: string[]
}

interface TenantSkillsResponse {
  skills: SkillPerf[]
}

// ── Mini sparkline SVG ────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2) {
    return <span className="text-xs text-[#8A8680]">—</span>
  }
  const w = 80
  const h = 28
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 10)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")

  const lastVal = values[values.length - 1]
  const color = lastVal >= 7.5 ? "#1A9E68" : lastVal >= 6 ? "#C97C0A" : "#EF4444"

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Score color helpers ───────────────────────────────────────────────────────

function scoreColor(score: number | null) {
  if (score === null) return "text-[#8A8680]"
  if (score >= 7.5) return "text-[#1A9E68]"
  if (score >= 6)   return "text-[#C97C0A]"
  return "text-red-600"
}

function scoreBg(score: number | null) {
  if (score === null) return ""
  if (score >= 7.5) return "bg-[#E8F7F0]"
  if (score >= 6)   return "bg-[#FFF8EC]"
  return "bg-[#FEF2F2]"
}

// ── Skill row ─────────────────────────────────────────────────────────────────

function SkillRow({ skill }: { skill: SkillPerf }) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-3.5 border-b border-[#F0EDE6] hover:bg-[#FAFAF8] transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#0F0F0D] truncate">{skill.skillName}</p>
          <p className="text-xs text-[#8A8680]">{skill.skillSlug}</p>
        </div>

        <div className={cn("w-20 text-center px-2 py-0.5 rounded-full text-sm font-semibold", scoreBg(skill.avgJudgeScore30d), scoreColor(skill.avgJudgeScore30d))}>
          {skill.avgJudgeScore30d != null ? skill.avgJudgeScore30d.toFixed(1) : "—"}
        </div>

        <div className="w-20 text-center text-sm text-[#0F0F0D]">
          {skill.passRate != null ? `${Math.round(skill.passRate * 100)} %` : "—"}
        </div>

        <div className="w-24 text-center text-sm text-[#0F0F0D]">
          {skill.approvalRate != null ? `${Math.round(skill.approvalRate * 100)} %` : "—"}
        </div>

        <div className="w-16 text-center text-sm text-[#0F0F0D]">{skill.tasksLast30d}</div>

        <div className="w-20 flex justify-center">
          <Sparkline values={skill.judgeHistory} />
        </div>

        <div className="w-4 flex-shrink-0 text-[#8A8680]">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 py-4 bg-[#FAFAF8] border-b border-[#F0EDE6]">
          {skill.tasksLast30d < 30 && (
            <p className="text-xs text-[#8A8680] mb-3">
              Données disponibles après 30 tâches. ({skill.tasksLast30d}/30 effectuées)
            </p>
          )}
          {skill.topFailureReasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wider mb-2">
                Principales raisons d'échec
              </p>
              <ul className="flex flex-col gap-1">
                {skill.topFailureReasons.map((r, i) => (
                  <li key={i} className="text-xs text-[#0F0F0D] flex items-center gap-2">
                    <span className="w-4 h-4 flex items-center justify-center rounded-full bg-red-100 text-red-600 font-bold text-[10px]">{i + 1}</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {skill.topFailureReasons.length === 0 && skill.tasksLast30d >= 30 && (
            <p className="text-xs text-[#1A9E68]">Aucun échec fréquent détecté sur les 30 derniers jours.</p>
          )}
        </div>
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminSkillPerformance() {
  const [selectedTenant, setSelectedTenant] = React.useState("")

  const tenantsQuery = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => adminApi.listTenants().then(r => r.tenants),
    staleTime: 60_000,
  })

  const skillsQuery = useQuery({
    queryKey: ["admin-skill-performance", selectedTenant],
    queryFn: () =>
      adminApi.get<TenantSkillsResponse>(`/admin/companies/${selectedTenant}/skills/performance`)
        .catch(() => ({ skills: [] as SkillPerf[] })),
    enabled: selectedTenant.length > 10,
    staleTime: 30_000,
  })

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-[#8A8680]" />
              <h1 className="text-2xl font-serif font-semibold text-[#0F0F0D]">Performance des compétences</h1>
            </div>
            <p className="text-sm text-[#8A8680]">
              Métriques de qualité par compétence et par tenant — admin uniquement.
            </p>
          </div>

          <div className="flex-shrink-0">
            <select
              value={selectedTenant}
              onChange={e => setSelectedTenant(e.target.value)}
              className="text-sm border border-[#E8E4DC] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] bg-white min-w-[220px]"
            >
              <option value="">Sélectionner un tenant…</option>
              {tenantsQuery.data?.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {!selectedTenant && (
          <div className="bg-white border border-[#E8E4DC] rounded-2xl px-5 py-12 text-center">
            <p className="text-sm text-[#8A8680]">Sélectionnez un tenant pour voir ses métriques de compétences.</p>
          </div>
        )}

        {selectedTenant && (
          <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-3 bg-[#FAFAF8] border-b border-[#E8E4DC]">
              <div className="flex-1 text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Compétence</div>
              <div className="w-20 text-center text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Score juge</div>
              <div className="w-20 text-center text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Taux OK</div>
              <div className="w-24 text-center text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Approbation</div>
              <div className="w-16 text-center text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Tâches</div>
              <div className="w-20 text-center text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Tendance</div>
              <div className="w-4" />
            </div>

            {skillsQuery.isLoading && (
              <div className="flex items-center gap-2 px-5 py-6 text-sm text-[#8A8680]">
                <Loader2 size={14} className="animate-spin" /> Chargement…
              </div>
            )}

            {skillsQuery.data?.skills.length === 0 && !skillsQuery.isLoading && (
              <p className="px-5 py-8 text-sm text-[#8A8680] text-center">
                Aucune compétence installée ou aucune tâche exécutée pour ce tenant.
              </p>
            )}

            {skillsQuery.data?.skills.map(skill => (
              <SkillRow key={skill.skillId} skill={skill} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-6 text-xs text-[#8A8680]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#1A9E68] inline-block" />
            Score ≥ 7.5 — excellent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#C97C0A] inline-block" />
            Score 6–7.5 — à surveiller
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Score &lt; 6 — intervention requise
          </span>
        </div>
      </div>
    </div>
  )
}
