import * as React from "react"
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useParams, useNavigate } from "@/lib/router"
import { adminApi } from "@/api/admin"
import { ArrowLeft, Eye, EyeOff, User, Bot, Clock } from "lucide-react"
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
  owner: "Owner",
  admin: "Admin",
  member: "Membre",
  viewer: "Lecteur",
};

export function AdminTenantDetail() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const { formatDate, formatDateTime, formatEuros, formatNumber } = useLocale()
  const [impersonating, setImpersonating] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "tenant", companyId],
    queryFn: () => adminApi.getTenant(companyId!),
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

        {/* Metrics */}
        <Section title="30-day metrics">
          <Row label="Tasks" value={tasksLast30d} />
          <Row label="Cost" value={formatEuros(costLast30d)} />
          <Row label="Tasks used this month" value={`${company.tasksUsed} / ${company.tasksLimit}`} />
          <Row label="Tokens used this month" value={`${(company.tokensUsed / 1_000).toFixed(0)}k / ${(company.tokensLimit / 1_000).toFixed(0)}k`} />
        </Section>

        {/* Company info */}
        <Section title="Informations">
          <Row label="Locale" value={company.locale} />
          <Row label="Fuseau horaire" value={company.timezone} />
          <Row label="Created" value={formatDate(company.createdAt)} />
          {company.stripeCustomerId && <Row label="Stripe customer" value={<code className="text-xs font-mono">{company.stripeCustomerId}</code>} />}
          {company.stripeSubId && <Row label="Stripe subscription" value={<code className="text-xs font-mono">{company.stripeSubId}</code>} />}
        </Section>

        {/* Members */}
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

        {/* Agents */}
        <Section title={`Agents (${agents.length})`}>
          {agents.length === 0 && <div className="px-5 py-4 text-xs text-[#8A8680]">Aucun agent.</div>}
          {agents.map((a) => (
            <div key={a.id} className="px-5 py-3 flex items-center gap-3 border-b border-[#F0EDE6] last:border-0">
              <Bot size={13} className="text-[#8A8680] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[#0F0F0D]">{a.name}</div>
                <div className="text-xs text-[#8A8680]">{a.role}</div>
              </div>
              <span className={cn("text-xs font-medium", a.status === "active" ? "text-[#1A9E68]" : "text-[#8A8680]")}>
                {a.status}
              </span>
            </div>
          ))}
        </Section>

        {/* Audit log */}
        <Section title="Audit log (last 10 entries)">
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
