import * as React from "react"
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useParams, useNavigate } from "@/lib/router"
import { adminApi } from "@/api/admin"
import { trustApi, type TrustScore } from "@/api/trust"
import { ArrowLeft, Eye, EyeOff, User, Bot, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/useLocale"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-[#F0EDE6]">
        <h2 className="text-sm font-semibold text-[#0F0F0D]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-4 border-b border-[#F0EDE6] last:border-0">
      <span className="text-xs text-[#8A8680]">{label}</span>
      <span className="text-xs font-medium text-[#0F0F0D] text-right">{value}</span>
    </div>
  )
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Admin",
  member: "Membre",
  viewer: "Lecteur",
};

const AUTONOMY_LABELS: Record<string, string> = {
  manual:       "Manuel",
  supervised:   "Supervisé",
  spot_checked: "Contrôle ponctuel",
  autonomous:   "Autonome",
  building:     "En construction",
  trusted:      "Autonome",
  highlyTrusted: "Très autonome",
}

const AUTONOMY_COLORS: Record<string, string> = {
  manual:       "bg-[#FEE2E2] text-[#DC2626]",
  supervised:   "bg-[#FEF3C7] text-[#C97C0A]",
  spot_checked: "bg-[#E8F0F8] text-[#1A4E8C]",
  autonomous:   "bg-[#E8F5EE] text-[#1A9E68]",
  building:     "bg-[#FEF3C7] text-[#C97C0A]",
  trusted:      "bg-[#E8F5EE] text-[#1A9E68]",
  highlyTrusted: "bg-[#EDE9FE] text-[#7C3AED]",
}

function MiniScoreBar({ value }: { value: number }) {
  const pct = Math.round((value / 5) * 100)
  const color = value >= 4 ? "bg-[#1A9E68]" : value >= 3 ? "bg-[#C97C0A]" : "bg-[#DC2626]"
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 bg-[#F0EDE6] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-[#8A8680]">{value.toFixed(1)}</span>
    </div>
  )
}

export function AdminTenantDetail() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const { formatDate, formatDateTime, formatEuros } = useLocale()
  const [impersonating, setImpersonating] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "tenant", companyId],
    queryFn: () => adminApi.getTenant(companyId!),
    enabled: !!companyId,
  })

  const { data: trustData } = useQuery({
    queryKey: ["admin", "trust-detail", companyId],
    queryFn: () => trustApi.getCompanyTrust(companyId!).catch(() => ({ scores: [] as TrustScore[], proposals: [] })),
    enabled: !!companyId,
  })

  const startImpersonate = useMutation({
    mutationFn: () => adminApi.startImpersonation(companyId!),
    onSuccess: () => setImpersonating(true),
  })

  const endImpersonate = useMutation({
    mutationFn: () => adminApi.endImpersonation(companyId!),
    onSuccess: () => setImpersonating(false),
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-red-600">Tenant introuvable ou accès refusé.</p>
      </div>
    )
  }

  const { company, members, agents, tasksLast30d, costLast30d, recentAudit } = data
  const trustScores = trustData?.scores ?? []
  const trustByAgent = new Map<string, TrustScore[]>()
  for (const ts of trustScores) {
    const existing = trustByAgent.get(ts.agentId) ?? []
    trustByAgent.set(ts.agentId, [...existing, ts])
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">

        <button
          onClick={() => navigate("/instance/admin")}
          className="flex items-center gap-1.5 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors w-fit"
        >
          <ArrowLeft size={14} />
          Retour
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">{company.name}</h1>
            <p className="text-sm text-[#8A8680] mt-0.5">{company.slug} · {company.plan} · {company.status}</p>
          </div>

          {impersonating ? (
            <button
              onClick={() => endImpersonate.mutate()}
              disabled={endImpersonate.isPending}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#FDF3E7] text-[#C97C0A] border border-[#C97C0A]/30 hover:bg-[#F5E9D4] transition-colors"
            >
              <EyeOff size={14} />
              Terminer impersonation
            </button>
          ) : (
            <button
              onClick={() => startImpersonate.mutate()}
              disabled={startImpersonate.isPending}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#E8F0F8] text-[#1A4E8C] border border-[#1A4E8C]/20 hover:bg-[#D8E8F4] transition-colors"
            >
              <Eye size={14} />
              Vue client
            </button>
          )}
        </div>

        {impersonating && (
          <div className="rounded-xl bg-[#FDF3E7] border border-[#C97C0A]/30 px-4 py-3">
            <p className="text-sm text-[#C97C0A] font-medium">Mode impersonation actif — lecture seule, audité.</p>
          </div>
        )}

        <Section title="Métriques 30 jours">
          <Row label="Tâches" value={tasksLast30d} />
          <Row label="Coût" value={formatEuros(costLast30d)} />
          <Row label="Tâches utilisées ce mois" value={`${company.tasksUsed} / ${company.tasksLimit}`} />
          <Row label="Tokens utilisés ce mois" value={`${(company.tokensUsed / 1_000).toFixed(0)}k / ${(company.tokensLimit / 1_000).toFixed(0)}k`} />
        </Section>

        <Section title="Informations">
          <Row label="Locale" value={company.locale} />
          <Row label="Fuseau horaire" value={company.timezone} />
          <Row label="Créé le" value={formatDate(company.createdAt)} />
          {company.stripeCustomerId && <Row label="Stripe customer" value={<code className="text-xs font-mono">{company.stripeCustomerId}</code>} />}
          {company.stripeSubId && <Row label="Stripe subscription" value={<code className="text-xs font-mono">{company.stripeSubId}</code>} />}
        </Section>

        <Section title={`Membres (${members.length})`}>
          {members.length === 0 && <div className="px-5 py-4 text-xs text-[#8A8680]">Aucun membre.</div>}
          {members.map((m) => (
            <div key={m.userId} className="px-5 py-3 flex items-center gap-3 border-b border-[#F0EDE6] last:border-0">
              <User size={13} className="text-[#8A8680] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[#0F0F0D] truncate">{m.name ?? m.email ?? m.userId}</div>
                {m.email && m.name && <div className="text-xs text-[#8A8680] truncate">{m.email}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-[#8A8680]">{ROLE_LABELS[m.role] ?? m.role}</span>
                <span className={cn("w-1.5 h-1.5 rounded-full", m.status === "active" ? "bg-[#1A9E68]" : "bg-[#CACAC8]")} />
              </div>
            </div>
          ))}
        </Section>

        <Section title={`Agents (${agents.length})`}>
          {agents.length === 0 && <div className="px-5 py-4 text-xs text-[#8A8680]">Aucun agent.</div>}
          {agents.map((a) => {
            const agentScores = trustByAgent.get(a.id) ?? []
            const topScore = agentScores[0]
            return (
              <div key={a.id} className="px-5 py-3 flex items-start gap-3 border-b border-[#F0EDE6] last:border-0">
                <Bot size={13} className="text-[#8A8680] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-medium text-[#0F0F0D]">{a.name}</span>
                    <span className={cn("text-xs font-medium", a.status === "active" ? "text-[#1A9E68]" : "text-[#8A8680]")}>
                      {a.status}
                    </span>
                    {topScore && (
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", AUTONOMY_COLORS[topScore.autonomyLevel] ?? "bg-[#F0EDE6] text-[#8A8680]")}>
                        {AUTONOMY_LABELS[topScore.autonomyLevel] ?? topScore.autonomyLevel}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#8A8680] mb-1">{a.role}</div>
                  {topScore && <MiniScoreBar value={topScore.score} />}
                  {agentScores.length > 1 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {agentScores.slice(1).map((ts) => (
                        <span key={ts.skillType} className="text-[10px] text-[#8A8680] bg-[#F0EDE6] px-1.5 py-0.5 rounded font-mono">
                          {ts.skillType}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </Section>

        {trustScores.length > 0 && (
          <Section title="Compétences par agent">
            {trustScores.map((ts) => (
              <div key={`${ts.agentId}-${ts.skillType}`} className="px-5 py-3 flex items-center gap-3 border-b border-[#F0EDE6] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[#0F0F0D]">{ts.agentName ?? ts.agentId.slice(0, 8)}</span>
                    <span className="text-xs font-mono text-[#8A8680]">{ts.skillType}</span>
                  </div>
                  <MiniScoreBar value={ts.score} />
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", AUTONOMY_COLORS[ts.autonomyLevel] ?? "bg-[#F0EDE6] text-[#8A8680]")}>
                    {AUTONOMY_LABELS[ts.autonomyLevel] ?? ts.autonomyLevel}
                  </span>
                  <span className="text-[10px] text-[#8A8680]">{ts.taskCountWindow} tâches</span>
                </div>
              </div>
            ))}
            {trustScores.length === 0 && (
              <div className="px-5 py-4 flex items-center gap-2 text-xs text-[#8A8680]">
                <AlertCircle size={12} />
                Aucun score de compétence enregistré.
              </div>
            )}
          </Section>
        )}

        <Section title="Journal d'audit (10 dernières entrées)">
          {recentAudit.length === 0 && <div className="px-5 py-4 text-xs text-[#8A8680]">Aucune entrée.</div>}
          {recentAudit.map((entry) => (
            <div key={entry.id} className="px-5 py-3 flex items-start gap-3 border-b border-[#F0EDE6] last:border-0">
              <Clock size={12} className="text-[#8A8680] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[#0F0F0D]">{entry.actionType}</div>
                <div className="text-xs text-[#8A8680]">{formatDateTime(entry.createdAt)}</div>
              </div>
              <span className={cn("text-xs", entry.result === "success" ? "text-[#1A9E68]" : "text-red-500")}>
                {entry.result}
              </span>
            </div>
          ))}
        </Section>

      </div>
    </div>
  )
}
