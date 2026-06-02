import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "@/api/admin"
import { adminPlanApi, type Plan, type TenantPlan } from "@/api/adminPlan"
import { CreditCard, Zap, Database, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const PLAN_LABELS: Record<Plan, string> = {
  solo:       "Solo",
  growth:     "Growth",
  pro:        "Pro",
  enterprise: "Enterprise",
}

const PLAN_COLORS: Record<Plan, string> = {
  solo:       "bg-[#F0EDE6] text-[#8A8680]",
  growth:     "bg-[#E6F4ED] text-[#1A9E68]",
  pro:        "bg-[#EDE9FE] text-[#7C3AED]",
  enterprise: "bg-[#FEE2E2] text-[#DC2626]",
}

const ALL_PLANS: Plan[] = ["solo", "growth", "pro", "enterprise"]

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const color = pct > 90 ? "bg-[#DC2626]" : pct > 70 ? "bg-[#C97C0A]" : "bg-[#1A9E68]"
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-[#8A8680]">
        <span>{label}</span>
        <span>{used.toLocaleString("fr-FR")} / {limit.toLocaleString("fr-FR")}</span>
      </div>
      <div className="h-1.5 bg-[#F0EDE6] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function PlanPanel({ plan }: { plan: TenantPlan }) {
  const qc = useQueryClient()
  const [newPlan, setNewPlan] = React.useState<Plan>(plan.plan)
  const [tasksOverride, setTasksOverride] = React.useState("")
  const [tokensOverride, setTokensOverride] = React.useState("")

  const setPlan = useMutation({
    mutationFn: (payload: { plan?: Plan; tasksLimitMonth?: number; tokensLimitMonth?: number }) =>
      adminPlanApi.setPlan(plan.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "plan", plan.id] })
      setTasksOverride("")
      setTokensOverride("")
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: { plan?: Plan; tasksLimitMonth?: number; tokensLimitMonth?: number } = {}
    if (newPlan !== plan.plan) payload.plan = newPlan
    if (tasksOverride) payload.tasksLimitMonth = parseInt(tasksOverride, 10)
    if (tokensOverride) payload.tokensLimitMonth = parseInt(tokensOverride, 10)
    if (Object.keys(payload).length === 0) return
    setPlan.mutate(payload)
  }

  return (
    <div className="bg-white border border-[#E8E4DC] rounded-2xl p-6 flex flex-col gap-5">
      {/* Current state */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[#8A8680] uppercase tracking-wider">Plan actuel</span>
          <span className={cn("inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit", PLAN_COLORS[plan.plan])}>
            {PLAN_LABELS[plan.plan]}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-[#8A8680]">
          {plan.stripeCustomerId ? (
            <span className="flex items-center gap-1"><CreditCard size={12} /> Stripe connecté</span>
          ) : (
            <span className="text-[#C97C0A]">Pas de Stripe</span>
          )}
          {plan.stripeSubId && <code className="font-mono text-[10px]">{plan.stripeSubId}</code>}
        </div>
      </div>

      {/* Usage */}
      <div className="flex flex-col gap-3">
        <UsageBar used={plan.tasksUsedMonth} limit={plan.tasksLimitMonth} label="Tasks / month" />
        <UsageBar used={plan.tokensUsedMonth} limit={plan.tokensLimitMonth} label="Tokens / mois" />
      </div>

      {/* Override form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-3 border-t border-[#F0EDE6]">
        <p className="text-xs font-semibold text-[#0F0F0D]">Modifier le plan</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#8A8680]">Plan</label>
          <select
            value={newPlan}
            onChange={(e) => setNewPlan(e.target.value as Plan)}
            className="text-sm border border-[#E8E4DC] rounded-xl px-3 py-2 bg-white text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#1A9E68]"
          >
            {ALL_PLANS.map((p) => (
              <option key={p} value={p}>{PLAN_LABELS[p]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8A8680]">Limite tâches (optionnel)</label>
            <input
              type="number"
              value={tasksOverride}
              onChange={(e) => setTasksOverride(e.target.value)}
              placeholder={plan.tasksLimitMonth.toString()}
              className="text-sm border border-[#E8E4DC] rounded-xl px-3 py-2 bg-white text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#1A9E68]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8A8680]">Limite tokens (optionnel)</label>
            <input
              type="number"
              value={tokensOverride}
              onChange={(e) => setTokensOverride(e.target.value)}
              placeholder={plan.tokensLimitMonth.toString()}
              className="text-sm border border-[#E8E4DC] rounded-xl px-3 py-2 bg-white text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#1A9E68]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={setPlan.isPending}
          className="w-full py-2 rounded-xl text-sm font-semibold bg-[#0F0F0D] text-white hover:bg-[#1A1A18] disabled:opacity-50 transition-colors"
        >
          {setPlan.isPending ? "Enregistrement…" : "Appliquer"}
        </button>

        {setPlan.isError && (
          <p className="text-xs text-red-600">Erreur lors de la mise à jour du plan.</p>
        )}
        {setPlan.isSuccess && (
          <p className="text-xs text-[#1A9E68]">Plan mis à jour.</p>
        )}
      </form>
    </div>
  )
}

export function AdminBilling() {
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("")

  const { data: tenants } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants().then((r) => r.tenants),
  })

  React.useEffect(() => {
    if (tenants?.length && !selectedCompanyId) setSelectedCompanyId(tenants[0].id)
  }, [tenants, selectedCompanyId])

  const { data: plan, isLoading } = useQuery({
    queryKey: ["admin", "plan", selectedCompanyId],
    queryFn: () => adminPlanApi.getTenantPlan(selectedCompanyId),
    enabled: !!selectedCompanyId,
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-serif text-[#0F0F0D]">Facturation & Plan</h1>
          <p className="text-sm text-[#8A8680] mt-1">Gestion des plans et limites d'usage par tenant</p>
        </div>

        {tenants && (
          <div className="mb-5">
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

        {plan && <PlanPanel plan={plan} />}
      </div>
    </div>
  )
}
