import * as React from "react"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@/lib/router"
import { adminApi, type TenantSummary, type EmbeddingMetric } from "@/api/admin"
import { Users, Bot, CheckSquare, Euro, ExternalLink, Eye, AlertTriangle, Plus, Pencil, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/useLocale"

const PLAN_BADGE: Record<string, string> = {
  solo:       "bg-[#F0EDE6] text-[#4B4846]",
  growth:     "bg-[#E8F5EE] text-[#1A9E68]",
  pro:        "bg-[#E8F0F8] text-[#1A4E8C]",
  enterprise: "bg-[#FDF3E7] text-[#C97C0A]",
};

const STATUS_DOT: Record<string, string> = {
  active:    "bg-[#1A9E68]",
  suspended: "bg-[#C97C0A]",
  inactive:  "bg-[#CACAC8]",
};

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", PLAN_BADGE[plan] ?? "bg-[#F0EDE6] text-[#4B4846]")}>
      {plan}
    </span>
  );
}

function Metric({ icon: Icon, value, label }: { icon: React.ElementType; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-[#8A8680]">
      <Icon size={11} />
      <span className="font-medium text-[#4B4846]">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function EmbeddingPill({ metric }: { metric: EmbeddingMetric | undefined }) {
  if (!metric) return <span className="text-xs text-[#CACAC8] font-mono">—</span>
  const score = metric.embeddingScore
  const color = score > 60 ? "bg-[#E8F5EE] text-[#1A9E68]" : score >= 20 ? "bg-[#FEF3C7] text-[#C97C0A]" : "bg-[#FEE2E2] text-[#DC2626]"
  return <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums", color)}>{score}</span>
}

// ── Create tenant modal ───────────────────────────────────────────────────────

function CreateTenantModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState("")
  const [plan, setPlan] = useState("solo")
  const [error, setError] = useState("")

  const create = useMutation({
    mutationFn: () => (adminApi as any).createTenant({ name, plan }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] })
      onClose()
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : typeof err === "string" ? err : "Erreur lors de la création"),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">Nouveau tenant</h2>
          <button onClick={onClose} className="text-[#8A8680] hover:text-[#0F0F0D]"><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="tenant-name" className="text-xs font-medium text-[#4B4846] mb-1.5 block">Nom de l'entreprise *</label>
            <input
              id="tenant-name"
              type="text"
              autoComplete="new-password"
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setError("") }}
              onKeyDown={e => e.key === "Enter" && name.trim() && create.mutate()}
              placeholder="Ex : Acme SAS"
              className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30 focus:border-[#1A9E68]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#4B4846] mb-1.5 block">Plan</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "solo", label: "Solo" },
                { value: "growth", label: "Croissance" },
                { value: "pro", label: "Pro" },
                { value: "enterprise", label: "Entreprise" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPlan(opt.value)}
                  className={cn(
                    "py-2 px-2 rounded-lg border text-xs font-medium transition-colors",
                    plan === opt.value
                      ? "border-[#1A9E68] bg-[#E8F5EE] text-[#1A9E68]"
                      : "border-[#E8E4DC] text-[#4B4846] hover:border-[#CACAC8]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors">Annuler</button>
          <button
            onClick={() => create.mutate()}
            disabled={!name.trim() || create.isPending}
            className="px-4 py-2 text-sm bg-[#0F0F0D] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
          >
            {create.isPending ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit tenant modal ─────────────────────────────────────────────────────────

function EditTenantModal({ tenant, onClose }: { tenant: TenantSummary; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(tenant.name)
  const [status, setStatus] = useState(tenant.status)
  const [error, setError] = useState("")

  const update = useMutation({
    mutationFn: () => (adminApi as any).updateTenant(tenant.id, { name, status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] })
      onClose()
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : typeof err === "string" ? err : "Erreur lors de la mise à jour"),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">Modifier le tenant</h2>
          <button onClick={onClose} className="text-[#8A8680] hover:text-[#0F0F0D]"><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="edit-tenant-name" className="text-xs font-medium text-[#4B4846] mb-1.5 block">Nom</label>
            <input
              id="edit-tenant-name"
              type="text"
              autoComplete="new-password"
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setError("") }}
              onKeyDown={e => e.key === "Enter" && name.trim() && update.mutate()}
              className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30 focus:border-[#1A9E68]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#4B4846] mb-1.5 block">Statut</label>
            <div className="flex gap-2">
              {[
                { value: "active", label: "Actif" },
                { value: "suspended", label: "Suspendu" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-xs font-medium transition-colors",
                    status === opt.value
                      ? opt.value === "active"
                        ? "border-[#1A9E68] bg-[#E8F5EE] text-[#1A9E68]"
                        : "border-[#C97C0A] bg-[#FDF3E7] text-[#C97C0A]"
                      : "border-[#E8E4DC] text-[#4B4846] hover:border-[#CACAC8]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors">Annuler</button>
          <button
            onClick={() => update.mutate()}
            disabled={!name.trim() || update.isPending}
            className="px-4 py-2 text-sm bg-[#0F0F0D] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
          >
            {update.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AdminTenants() {
  const navigate = useNavigate()
  const { formatEuros } = useLocale()
  const [impersonating, setImpersonating] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTenant, setEditingTenant] = useState<TenantSummary | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants(),
    refetchInterval: 60_000,
  })

  const { data: embeddingData } = useQuery({
    queryKey: ["admin", "embedding-metrics"],
    queryFn: () => adminApi.listEmbeddingMetrics().catch(() => ({ metrics: [] as EmbeddingMetric[] })),
    refetchInterval: 120_000,
  })

  const impersonateMutation = useMutation({
    mutationFn: (companyId: string) => adminApi.startImpersonation(companyId),
    onSuccess: (session) => setImpersonating(session.companyId),
  })

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-red-600">Accès refusé ou erreur serveur.</p>
    </div>
  )

  const tenants = data?.tenants ?? []
  const embeddingMap = new Map<string, EmbeddingMetric>(
    (embeddingData?.metrics ?? []).map((m) => [m.companyId, m])
  )

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">Tenants</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#8A8680]">{tenants.length} entreprise{tenants.length !== 1 ? "s" : ""}</span>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#0F0F0D] text-white rounded-lg hover:bg-[#333] transition-colors"
            >
              <Plus size={14} />
              Nouveau tenant
            </button>
          </div>
        </div>

        {impersonating && (
          <div className="rounded-xl bg-[#FDF3E7] border border-[#C97C0A]/30 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-[#C97C0A] font-medium">Mode impersonation actif — vue lecture seule</p>
            <button
              onClick={async () => { await adminApi.endImpersonation(impersonating); setImpersonating(null) }}
              className="text-xs text-[#C97C0A] underline underline-offset-2"
            >
              Terminer
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm divide-y divide-[#F0EDE6]">
          {tenants.length === 0 && (
            <div className="p-8 text-center text-sm text-[#8A8680]">Aucun tenant. Créez le premier avec le bouton ci-dessus.</div>
          )}
          {tenants.map((t: TenantSummary) => {
            const em = embeddingMap.get(t.id)
            const atRisk = em && em.embeddingScore < 20
            const expansion = em && em.embeddingScore > 60
            return (
              <div key={t.id} className="p-4 flex items-center gap-4 hover:bg-[#FAFAF8] transition-colors">
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-0.5", STATUS_DOT[t.status] ?? "bg-[#CACAC8]")} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium text-[#0F0F0D] truncate">{t.name}</span>
                    {atRisk && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FEF3C7] text-[#C97C0A]">
                        <AlertTriangle size={8} />À risque
                      </span>
                    )}
                    {expansion && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#E8F5EE] text-[#1A9E68]">
                        ↗ Expansion
                      </span>
                    )}
                    <PlanBadge plan={t.plan} />
                    {t.stripeCustomerId && <span className="text-xs text-[#1A9E68]">Stripe ✓</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Metric icon={Users} value={t.members} label="membres" />
                    <Metric icon={Bot} value={t.activeAgents} label="agents actifs" />
                    <Metric icon={CheckSquare} value={t.tasksLast30d} label="tâches/30j" />
                    <Metric icon={Euro} value={formatEuros(t.costLast30d)} label="/30j" />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <EmbeddingPill metric={em} />
                  <button
                    onClick={() => setEditingTenant(t)}
                    className="flex items-center gap-1 text-xs text-[#8A8680] hover:text-[#0F0F0D] transition-colors px-2 py-1 rounded-lg hover:bg-[#F0EDE6]"
                    title="Modifier"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => navigate(`/instance/admin/tenants/${t.id}`)}
                    className="flex items-center gap-1 text-xs text-[#8A8680] hover:text-[#0F0F0D] transition-colors px-2 py-1 rounded-lg hover:bg-[#F0EDE6]"
                  >
                    <ExternalLink size={12} />
                    Détail
                  </button>
                  <button
                    onClick={() => impersonateMutation.mutate(t.id)}
                    disabled={impersonateMutation.isPending}
                    className="flex items-center gap-1 text-xs text-[#1A4E8C] hover:text-[#1A4E8C]/80 transition-colors px-2 py-1 rounded-lg hover:bg-[#E8F0F8]"
                  >
                    <Eye size={12} />
                    Vue client
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} />}
      {editingTenant && <EditTenantModal tenant={editingTenant} onClose={() => setEditingTenant(null)} />}
    </div>
  )
}
