import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { qualityGatesApi, type QualityGate, type CreateGatePayload } from "@/api/qualityGates"
import { adminApi } from "@/api/admin"
import { Shield, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function useToast() {
  const [toasts, setToasts] = React.useState<{ id: number; msg: string; tone: "success" | "error" }[]>([])
  const push = React.useCallback((msg: string, tone: "success" | "error") => {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
  }, [])
  return { toasts, push }
}

const GATE_LABELS: Record<string, string> = {
  volume_limit:        "Limite de volume",
  recipient_whitelist: "Liste blanche destinataires",
  budget_limit:        "Limite de budget",
  content_forbidden:   "Contenu interdit",
}

const GATE_COLORS: Record<string, string> = {
  volume_limit:        "bg-[#EFF3FB] text-[#1A4E8C]",
  recipient_whitelist: "bg-[#E6F5EE] text-[#1A9E68]",
  budget_limit:        "bg-[#FEF3E2] text-[#C97C0A]",
  content_forbidden:   "bg-[#FFF0F0] text-[#D64B4B]",
}

function describeGate(gate: QualityGate): string {
  const c = gate.config as Record<string, unknown>
  switch (gate.gateType) {
    case "volume_limit":        return `Max ${c.maxPerDay} emails/jour`
    case "recipient_whitelist": return `Allowed domains: ${(c.allowedDomains as string[]).join(", ")}`
    case "budget_limit":        return `Limite : ${((c.limitCents as number) / 100).toFixed(2)} €/mois`
    case "content_forbidden":   return `Termes : ${(c.terms as string[]).slice(0, 3).join(", ")}${(c.terms as string[]).length > 3 ? "…" : ""}`
    default:                    return ""
  }
}

interface CreateGateDialogProps {
  companyId: string
  onClose: () => void
  onCreated: () => void
}

function CreateGateDialog({ companyId, onClose, onCreated }: CreateGateDialogProps) {
  const [gateType, setGateType] = React.useState<CreateGatePayload["gateType"]>("volume_limit")
  const [maxPerDay, setMaxPerDay] = React.useState("10")
  const [domains, setDomains] = React.useState("")
  const [limitEur, setLimitEur] = React.useState("100")
  const [terms, setTerms] = React.useState("")

  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: (p: CreateGatePayload) => qualityGatesApi.create(companyId, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "quality-gates", companyId] })
      onCreated()
      onClose()
    },
  })

  function buildPayload(): CreateGatePayload {
    switch (gateType) {
      case "volume_limit":
        return { gateType, config: { type: "volume_limit", maxPerDay: Number(maxPerDay) } }
      case "recipient_whitelist":
        return { gateType, config: { type: "recipient_whitelist", allowedDomains: domains.split(",").map((d) => d.trim()).filter(Boolean) } }
      case "budget_limit":
        return { gateType, config: { type: "budget_limit", limitCents: Math.round(Number(limitEur) * 100) } }
      case "content_forbidden":
        return { gateType, config: { type: "content_forbidden", terms: terms.split(",").map((t) => t.trim()).filter(Boolean) } }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">Nouvelle règle de sécurité</h2>

        <div>
          <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Type de règle</label>
          <select
            value={gateType}
            onChange={(e) => setGateType(e.target.value as CreateGatePayload["gateType"])}
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none appearance-none"
            style={{ borderColor: "#E8E4DC" }}
          >
            {Object.entries(GATE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {gateType === "volume_limit" && (
          <div>
            <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Emails max par jour par agent</label>
            <input
              type="number"
              min="1"
              value={maxPerDay}
              onChange={(e) => setMaxPerDay(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: "#E8E4DC" }}
            />
          </div>
        )}

        {gateType === "recipient_whitelist" && (
          <div>
            <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Domaines autorisés (séparés par virgule)</label>
            <input
              type="text"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="client.fr, partenaire.com"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: "#E8E4DC" }}
            />
          </div>
        )}

        {gateType === "budget_limit" && (
          <div>
            <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Limite mensuelle (€)</label>
            <input
              type="number"
              min="1"
              value={limitEur}
              onChange={(e) => setLimitEur(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: "#E8E4DC" }}
            />
          </div>
        )}

        {gateType === "content_forbidden" && (
          <div>
            <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Termes interdits (séparés par virgule)</label>
            <input
              type="text"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="concurrent, offre concurrente, promotionnel"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: "#E8E4DC" }}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-[#4B4846] hover:bg-[#F0EDE6] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => mut.mutate(buildPayload())}
            disabled={mut.isPending}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[#0F0F0D] text-white disabled:opacity-40 flex items-center gap-1.5"
          >
            {mut.isPending && <Loader2 size={13} className="animate-spin" />}
            Créer la règle
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdminQualityGates() {
  const { toasts, push } = useToast()
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string | null>(null)
  const [showCreate, setShowCreate] = React.useState(false)
  const qc = useQueryClient()

  const { data: tenants } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants().then((r) => r.tenants),
  })

  React.useEffect(() => {
    if (tenants?.length && !selectedCompanyId) setSelectedCompanyId(tenants[0].id)
  }, [tenants, selectedCompanyId])

  const { data: gates, isLoading } = useQuery({
    queryKey: ["admin", "quality-gates", selectedCompanyId],
    queryFn: () => qualityGatesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  })

  const { data: violations } = useQuery({
    queryKey: ["admin", "quality-gates-violations", selectedCompanyId],
    queryFn: () => qualityGatesApi.violations(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      qualityGatesApi.update(selectedCompanyId!, id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "quality-gates", selectedCompanyId] }),
    onError: () => push("Update failed", "error"),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => qualityGatesApi.remove(selectedCompanyId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "quality-gates", selectedCompanyId] })
      push("Rule deleted", "success")
    },
    onError: () => push("Erreur lors de la suppression", "error"),
  })

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">Règles de sécurité</h1>
            <p className="text-sm text-[#8A8680] mt-1">Quality gates par tenant</p>
          </div>
          {selectedCompanyId && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#0F0F0D] text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={15} />
              Ajouter une règle
            </button>
          )}
        </div>

        {/* Company selector */}
        {tenants && (
          <div>
            <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Tenant</label>
            <select
              value={selectedCompanyId ?? ""}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full max-w-xs px-3 py-2.5 rounded-xl border text-sm outline-none appearance-none bg-white"
              style={{ borderColor: "#E8E4DC" }}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {gates && gates.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E8E4DC] p-8 text-center">
            <Shield size={32} className="mx-auto text-[#D4CFC8] mb-3" />
            <p className="text-sm text-[#8A8680]">Aucune règle de sécurité configurée pour ce tenant.</p>
          </div>
        )}

        {gates && gates.length > 0 && (
          <div className="flex flex-col gap-3">
            {gates.map((gate) => (
              <div key={gate.id} className={cn("bg-white rounded-2xl border shadow-sm p-4", gate.enabled ? "border-[#E8E4DC]" : "border-[#E8E4DC] opacity-60")}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("text-xs font-medium px-2 py-1 rounded-lg", GATE_COLORS[gate.gateType])}>
                      {GATE_LABELS[gate.gateType]}
                    </span>
                    <span className="text-sm text-[#4B4846]">{describeGate(gate)}</span>
                    {gate.agentId && (
                      <span className="text-xs text-[#8A8680]">Agent spécifique</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleMut.mutate({ id: gate.id, enabled: !gate.enabled })}
                      className="text-[#8A8680] hover:text-[#0F0F0D] transition-colors"
                      title={gate.enabled ? "Disable" : "Enable"}
                    >
                      {gate.enabled
                        ? <ToggleRight size={20} className="text-[#1A9E68]" />
                        : <ToggleLeft size={20} />}
                    </button>
                    <button
                      onClick={() => deleteMut.mutate(gate.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8A8680] hover:text-[#D64B4B] hover:bg-[#FFF0F0] transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent violations */}
        {violations && violations.length > 0 && (
          <div>
            <h2 className="text-base font-[Georgia,serif] text-[#0F0F0D] mb-3">Violations récentes</h2>
            <div className="bg-white rounded-2xl border border-[#E8E4DC] divide-y divide-[#F0EDE6]">
              {violations.slice(0, 10).map((v) => (
                <div key={v.id} className="px-4 py-3 flex items-start gap-3">
                  <AlertTriangle size={14} className="text-[#C97C0A] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0F0F0D]">{v.violation}</p>
                    <p className="text-xs text-[#8A8680] mt-0.5">
                      {v.actionType} · {v.resolution ?? "unresolved"} · {new Date(v.createdAt).toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreate && selectedCompanyId && (
        <CreateGateDialog
          companyId={selectedCompanyId}
          onClose={() => setShowCreate(false)}
          onCreated={() => push("Rule created", "success")}
        />
      )}

      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn("px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg", t.tone === "success" ? "bg-[#0F0F0D] text-white" : "bg-[#D64B4B] text-white")}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
