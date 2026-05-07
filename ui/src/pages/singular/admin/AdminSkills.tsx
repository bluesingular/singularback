/**
 * Gap D — Admin skill list.
 *
 * Shows all pending_approval versions across all tenants (the review queue),
 * plus a search field to browse a specific company's skills.
 */

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@/lib/router"
import {
  CheckCircle2, XCircle, Clock, ChevronRight, Search, Loader2,
  GitBranch, Star,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { adminApi } from "../../../api/admin.js"

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft:            "bg-[#F5F5F3] text-[#6B7280]",
  review:           "bg-[#EEF4FF] text-[#1A4E8C]",
  staging:          "bg-[#FFF8EC] text-[#C97C0A]",
  active:           "bg-[#E8F7F0] text-[#1A9E68]",
  pending_approval: "bg-[#FEF3E0] text-[#C97C0A]",
  blocked:          "bg-[#FEF2F2] text-red-600",
  deprecated:       "bg-[#F5F5F3] text-[#9CA3AF]",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_COLORS[status] ?? "bg-[#F5F5F3] text-[#6B7280]")}>
      {status.replace("_", " ")}
    </span>
  )
}

// ── Pending version row ───────────────────────────────────────────────────────

interface PendingVersion {
  id: string
  companyId: string
  skillType: string
  version: string
  status: string
  benchmarkScore: string | null
  triggerReason: string | null
  createdAt: string
  companyName: string
}

function PendingRow({ v, onApprove, onReject, busy }: {
  v: PendingVersion
  onApprove: (id: string) => void
  onReject:  (id: string) => void
  busy: boolean
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[#F0EDE6] last:border-0 hover:bg-[#FAFAF8] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <GitBranch size={13} className="text-[#8A8680] flex-shrink-0" />
          <span className="text-sm font-medium text-[#0F0F0D] truncate">{v.skillType}</span>
          <span className="text-xs text-[#8A8680]">v{v.version}</span>
          <StatusBadge status={v.status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-[#8A8680]">
          <span>{v.companyName}</span>
          {v.benchmarkScore != null && (
            <span className="flex items-center gap-1">
              <Star size={11} />
              {parseFloat(v.benchmarkScore).toFixed(2)}
            </span>
          )}
          <span>{v.triggerReason ?? "manual"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onApprove(v.id)}
          disabled={busy}
          className="flex items-center gap-1.5 text-xs font-medium text-[#1A9E68] hover:bg-[#E8F7F0] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          <CheckCircle2 size={13} />
          Approuver
        </button>
        <button
          onClick={() => onReject(v.id)}
          disabled={busy}
          className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          <XCircle size={13} />
          Rejeter
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminSkills() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchCompanyId, setSearchCompanyId] = React.useState("")
  const [searchSkillType, setSearchSkillType] = React.useState("")
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const pendingQuery = useQuery({
    queryKey: ["admin-skills-pending"],
    queryFn:  () => adminApi.get<{ versions: PendingVersion[] }>("/admin/skills/pending").then(r => r.versions),
    staleTime: 30_000,
  })

  const versionsQuery = useQuery({
    queryKey: ["admin-skills-versions", searchCompanyId, searchSkillType],
    queryFn:  () => adminApi.get<{ versions: unknown[] }>(
      `/admin/skills/${searchSkillType}/versions?companyId=${searchCompanyId}`,
    ).then(r => r.versions),
    enabled: searchCompanyId.length > 10 && searchSkillType.length > 2,
    staleTime: 30_000,
  })

  const approveMutation = useMutation({
    mutationFn: (versionId: string) =>
      adminApi.post(`/admin/skills/_/versions/${versionId}/approve`),
    onMutate: (id) => setBusyId(id),
    onSettled: () => {
      setBusyId(null)
      queryClient.invalidateQueries({ queryKey: ["admin-skills-pending"] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (versionId: string) =>
      adminApi.post(`/admin/skills/_/versions/${versionId}/reject`),
    onMutate: (id) => setBusyId(id),
    onSettled: () => {
      setBusyId(null)
      queryClient.invalidateQueries({ queryKey: ["admin-skills-pending"] })
    },
  })

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-serif font-semibold text-[#0F0F0D]">Compétences</h1>
          <p className="mt-1 text-sm text-[#8A8680]">
            File d'approbation et gestion des versions de compétences.
          </p>
        </div>

        {/* Pending approval queue */}
        <section className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-[#C97C0A]" />
              <h2 className="text-sm font-semibold text-[#0F0F0D]">En attente d'approbation</h2>
              {pendingQuery.data && (
                <span className="text-xs bg-[#FFF8EC] text-[#C97C0A] px-2 py-0.5 rounded-full font-medium">
                  {pendingQuery.data.length}
                </span>
              )}
            </div>
            {pendingQuery.isLoading && <Loader2 size={14} className="animate-spin text-[#8A8680]" />}
          </div>

          {pendingQuery.data?.length === 0 && (
            <p className="px-5 py-6 text-sm text-[#8A8680] text-center">
              Aucune version en attente. ✓
            </p>
          )}

          {pendingQuery.data?.map(v => (
            <PendingRow
              key={v.id}
              v={v}
              busy={busyId === v.id}
              onApprove={(id) => approveMutation.mutate(id)}
              onReject={(id) => rejectMutation.mutate(id)}
            />
          ))}
        </section>

        {/* Version browser */}
        <section className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDE6]">
            <h2 className="text-sm font-semibold text-[#0F0F0D] mb-3">Parcourir les versions</h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8680]" />
                <input
                  value={searchCompanyId}
                  onChange={e => setSearchCompanyId(e.target.value)}
                  placeholder="Company ID (UUID)"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-[#E8E4DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
                />
              </div>
              <input
                value={searchSkillType}
                onChange={e => setSearchSkillType(e.target.value)}
                placeholder="Skill type (ex: qualification-cv)"
                className="flex-1 px-3 py-2 text-sm border border-[#E8E4DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
              />
            </div>
          </div>

          {versionsQuery.isLoading && (
            <div className="flex items-center gap-2 px-5 py-4 text-sm text-[#8A8680]">
              <Loader2 size={14} className="animate-spin" /> Chargement…
            </div>
          )}

          {versionsQuery.data?.map((v: any) => (
            <button
              key={v.id}
              onClick={() => navigate(`/instance/admin/skills/${searchSkillType}/versions/${v.id}?companyId=${searchCompanyId}`)}
              className="w-full flex items-center gap-4 px-5 py-3.5 border-b border-[#F0EDE6] last:border-0 hover:bg-[#FAFAF8] transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#0F0F0D]">v{v.version}</span>
                  <StatusBadge status={v.status} />
                  {v.benchmarkScore != null && (
                    <span className="flex items-center gap-1 text-xs text-[#8A8680]">
                      <Star size={11} />
                      {parseFloat(v.benchmarkScore).toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#8A8680] mt-0.5">
                  {v.triggerReason ?? "manual"} · {new Date(v.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <ChevronRight size={15} className="text-[#8A8680]" />
            </button>
          ))}

          {versionsQuery.data?.length === 0 && (
            <p className="px-5 py-6 text-sm text-[#8A8680] text-center">
              Aucune version trouvée pour ce skill.
            </p>
          )}
        </section>

        {/* New version CTA */}
        <div className="flex justify-end">
          <button
            onClick={() => navigate(`/instance/admin/skills/new`)}
            className="text-sm font-medium text-white bg-[#1A9E68] hover:bg-[#158a5a] px-4 py-2 rounded-xl transition-colors"
          >
            + Nouvelle version
          </button>
        </div>
      </div>
    </div>
  )
}
