import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "@/api/admin"
import { trustApi, type TrustScore, type TrustProposal } from "@/api/trust"
import { CheckCircle2, XCircle, TrendingUp, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

const LEVEL_LABELS: Record<string, string> = {
  building:      "En construction",
  supervised:    "Supervised",
  trusted:       "Autonome",
  highlyTrusted: "Highly autonomous",
}

const LEVEL_COLORS: Record<string, string> = {
  building:      "bg-[#FEF3C7] text-[#C97C0A]",
  supervised:    "bg-[#E6EEF8] text-[#1A4E8C]",
  trusted:       "bg-[#E6F4ED] text-[#1A9E68]",
  highlyTrusted: "bg-[#EDE9FE] text-[#7C3AED]",
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round((value / 5) * 100)
  const color = value >= 4 ? "bg-[#1A9E68]" : value >= 3 ? "bg-[#C97C0A]" : "bg-[#DC2626]"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#F0EDE6] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-[#8A8680] w-6">{value.toFixed(1)}</span>
    </div>
  )
}

function ScoreCard({ s }: { s: TrustScore }) {
  return (
    <div className="bg-white border border-[#E8E4DC] rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[#0F0F0D]">{s.agentName ?? s.agentId.slice(0, 8)}</p>
          <p className="text-xs text-[#8A8680] font-mono">{s.skillType}</p>
        </div>
        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", LEVEL_COLORS[s.autonomyLevel] ?? "bg-[#F0EDE6] text-[#8A8680]")}>
          {LEVEL_LABELS[s.autonomyLevel] ?? s.autonomyLevel}
        </span>
      </div>
      <ScoreBar value={s.score} />
      <div className="flex gap-3 text-xs text-[#8A8680]">
        <span>Streak: {s.approvalStreak}</span>
        <span>·</span>
        <span>{s.taskCountWindow} tâches</span>
        {s.qualityRatingAvg != null && (
          <>
            <span>·</span>
            <span>★ {s.qualityRatingAvg.toFixed(1)}</span>
          </>
        )}
      </div>
    </div>
  )
}

function ProposalCard({ p, companyId }: { p: TrustProposal; companyId: string }) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "trust", companyId] })

  const approve = useMutation({
    mutationFn: () => trustApi.approveProposal(companyId, p.id),
    onSuccess: invalidate,
  })
  const reject = useMutation({
    mutationFn: () => trustApi.rejectProposal(companyId, p.id),
    onSuccess: invalidate,
  })

  return (
    <div className="bg-white border border-[#E8E4DC] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[#0F0F0D]">{p.agentName ?? p.agentId.slice(0, 8)}</p>
          <p className="text-xs text-[#8A8680] font-mono">{p.skillType}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", LEVEL_COLORS[p.currentLevel] ?? "bg-[#F0EDE6] text-[#8A8680]")}>
            {LEVEL_LABELS[p.currentLevel] ?? p.currentLevel}
          </span>
          <span className="text-xs text-[#8A8680]">→</span>
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", LEVEL_COLORS[p.proposedLevel] ?? "bg-[#F0EDE6] text-[#8A8680]")}>
            {LEVEL_LABELS[p.proposedLevel] ?? p.proposedLevel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs text-[#8A8680] bg-[#FAFAF8] rounded-lg p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider">Tâches</span>
          <span className="font-semibold text-[#0F0F0D]">{p.evidence.taskCount}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider">Note moy.</span>
          <span className="font-semibold text-[#0F0F0D]">★ {p.evidence.avgRating.toFixed(1)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider">Gates</span>
          <span className="font-semibold text-[#0F0F0D]">{Math.round(p.evidence.gatePassRate * 100)}%</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider">Schéma</span>
          <span className="font-semibold text-[#0F0F0D]">{Math.round(p.evidence.schemaPassRate * 100)}%</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => approve.mutate()}
          disabled={approve.isPending || reject.isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-[#1A9E68] text-white hover:bg-[#178a5a] disabled:opacity-50 transition-colors"
        >
          <CheckCircle2 size={14} />
          {approve.isPending ? "…" : "Approuver"}
        </button>
        <button
          onClick={() => reject.mutate()}
          disabled={approve.isPending || reject.isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border border-[#E8E4DC] text-[#0F0F0D] hover:bg-[#F0EDE6] disabled:opacity-50 transition-colors"
        >
          <XCircle size={14} />
          {reject.isPending ? "…" : "Refuser"}
        </button>
      </div>
    </div>
  )
}

export function AdminTrustConfig() {
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("")

  const { data: tenants } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants().then((r) => r.tenants),
  })

  React.useEffect(() => {
    if (tenants?.length && !selectedCompanyId) setSelectedCompanyId(tenants[0].id)
  }, [tenants, selectedCompanyId])

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "trust", selectedCompanyId],
    queryFn: () => trustApi.getCompanyTrust(selectedCompanyId),
    enabled: !!selectedCompanyId,
  })

  const proposals = data?.proposals ?? []
  const scores = data?.scores ?? []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-serif text-[#0F0F0D]">Confiance & Autonomie</h1>
          <p className="text-sm text-[#8A8680] mt-1">Niveaux d'autonomie des agents et propositions d'évolution par tenant</p>
        </div>

        {tenants && (
          <div className="mb-6">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="text-sm border border-[#E8E4DC] rounded-xl px-3 py-2 bg-white text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#1A9E68] w-full max-w-xs"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {isLoading && <div className="text-sm text-[#8A8680]">Chargement…</div>}

        {data && (
          <div className="flex flex-col gap-8">
            {/* Pending proposals */}
            {proposals.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={15} className="text-[#C97C0A]" />
                  <h2 className="text-sm font-semibold text-[#0F0F0D]">
                    Propositions en attente ({proposals.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {proposals.map((p) => (
                    <ProposalCard key={p.id} p={p} companyId={selectedCompanyId} />
                  ))}
                </div>
              </section>
            )}

            {/* All scores */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={15} className="text-[#1A9E68]" />
                <h2 className="text-sm font-semibold text-[#0F0F0D]">
                  Scores de confiance ({scores.length})
                </h2>
              </div>
              {scores.length === 0 ? (
                <p className="text-sm text-[#8A8680]">Aucun score enregistré pour ce tenant.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {scores.map((s) => (
                    <ScoreCard key={`${s.agentId}-${s.skillType}`} s={s} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
