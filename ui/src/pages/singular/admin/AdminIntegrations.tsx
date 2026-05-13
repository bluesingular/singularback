import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { integrationsApi, type Integration, type IntegrationType } from "@/api/integrations"
import { adminApi } from "@/api/admin"
import { Plug, Plus, Trash2, Users, ChevronDown, ChevronUp, Loader2, CheckCircle, XCircle } from "lucide-react"
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

const TYPE_LABELS: Record<string, string> = {
  gmail:           "Gmail",
  linkedin:        "LinkedIn",
  slack:           "Slack",
  calendly:        "Calendly",
  notion:          "Notion",
  airtable:        "Airtable",
  google_calendar: "Google Agenda",
  hubspot:         "HubSpot",
  custom:          "API personnalisée",
}

const TYPE_COLORS: Record<string, string> = {
  gmail:           "bg-[#FEF3E2] text-[#C97C0A]",
  linkedin:        "bg-[#EFF3FB] text-[#1A4E8C]",
  slack:           "bg-[#E6F5EE] text-[#1A9E68]",
  calendly:        "bg-[#F5EEF8] text-[#7B3FA0]",
  notion:          "bg-[#F0EDE6] text-[#4B4846]",
  airtable:        "bg-[#FFF0F0] text-[#D64B4B]",
  google_calendar: "bg-[#EFF3FB] text-[#1A4E8C]",
  hubspot:         "bg-[#FEF3E2] text-[#C97C0A]",
  custom:          "bg-[#F0EDE6] text-[#4B4846]",
}

interface CreateIntegrationDialogProps {
  companyId: string
  onClose: () => void
  onCreated: () => void
  push: (msg: string, tone: "success" | "error") => void
}

function CreateIntegrationDialog({ companyId, onClose, onCreated, push }: CreateIntegrationDialogProps) {
  const [type, setType] = React.useState<IntegrationType>("gmail")
  const [name, setName] = React.useState("")
  const [credentials, setCredentials] = React.useState("")
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: () => integrationsApi.create(companyId, { type, name: name || TYPE_LABELS[type], credentials }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "integrations", companyId] })
      push("Intégration ajoutée", "success")
      onCreated()
      onClose()
    },
    onError: () => push("Erreur lors de la création", "error"),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">Connecter une intégration</h2>

        <div>
          <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Service</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as IntegrationType)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none appearance-none bg-white"
            style={{ borderColor: "#E8E4DC" }}
          >
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Nom (optionnel)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={TYPE_LABELS[type]}
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
            style={{ borderColor: "#E8E4DC" }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Clé API / Token</label>
          <input
            type="password"
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            placeholder="sk-… ou token…"
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none font-mono"
            style={{ borderColor: "#E8E4DC" }}
          />
          <p className="text-xs text-[#8A8680] mt-1">Chiffré AES-256-GCM, jamais exposé au LLM.</p>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-[#4B4846] hover:bg-[#F0EDE6]">
            Annuler
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={!credentials.trim() || mut.isPending}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[#0F0F0D] text-white disabled:opacity-40 flex items-center gap-1.5"
          >
            {mut.isPending && <Loader2 size={13} className="animate-spin" />}
            Connecter
          </button>
        </div>
      </div>
    </div>
  )
}

interface PermissionsPanelProps {
  companyId: string
  integration: Integration
  push: (msg: string, tone: "success" | "error") => void
}

function PermissionsPanel({ companyId, integration, push }: PermissionsPanelProps) {
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ["admin", "integration-permissions", integration.id],
    queryFn: () => integrationsApi.getPermissions(companyId, integration.id),
  })

  const revokeMut = useMutation({
    mutationFn: (agentId: string) => integrationsApi.revokePermissions(companyId, integration.id, agentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "integration-permissions", integration.id] })
      push("Accès révoqué", "success")
    },
    onError: () => push("Erreur lors de la révocation", "error"),
  })

  if (!data) return <div className="py-2 flex justify-center"><div className="w-4 h-4 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="mt-3 border-t border-[#F0EDE6] pt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Users size={13} className="text-[#8A8680]" />
        <span className="text-xs font-medium text-[#4B4846]">Accès agents</span>
      </div>
      {data.grants.length === 0 ? (
        <p className="text-xs text-[#8A8680]">Aucun agent n'a accès à cette intégration.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {data.grants.map((g) => (
            <div key={g.agentId} className="flex items-center justify-between gap-2 bg-[#FAFAF8] rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-medium text-[#0F0F0D]">{g.agentName}</p>
                <p className="text-xs text-[#8A8680]">{g.permissions.join(", ")}</p>
              </div>
              <button
                onClick={() => revokeMut.mutate(g.agentId)}
                className="text-xs text-[#D64B4B] hover:underline"
              >
                Révoquer
              </button>
            </div>
          ))}
        </div>
      )}
      {data.availablePermissions.length > 0 && (
        <p className="text-xs text-[#B0AAA4] mt-2">
          Permissions disponibles : {data.availablePermissions.join(", ")}
        </p>
      )}
    </div>
  )
}

export function AdminIntegrations() {
  const { toasts, push } = useToast()
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string | null>(null)
  const [showCreate, setShowCreate] = React.useState(false)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const qc = useQueryClient()

  const { data: tenants } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants().then((r) => r.tenants),
  })

  React.useEffect(() => {
    if (tenants?.length && !selectedCompanyId) setSelectedCompanyId(tenants[0].id)
  }, [tenants, selectedCompanyId])

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["admin", "integrations", selectedCompanyId],
    queryFn: () => integrationsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => integrationsApi.remove(selectedCompanyId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "integrations", selectedCompanyId] })
      push("Intégration supprimée", "success")
    },
    onError: () => push("Erreur lors de la suppression", "error"),
  })

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">Intégrations</h1>
            <p className="text-sm text-[#8A8680] mt-1">Services connectés par tenant</p>
          </div>
          {selectedCompanyId && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#0F0F0D] text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={15} />
              Connecter
            </button>
          )}
        </div>

        {tenants && (
          <div>
            <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Tenant</label>
            <select
              value={selectedCompanyId ?? ""}
              onChange={(e) => { setSelectedCompanyId(e.target.value); setExpandedId(null) }}
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

        {integrations && integrations.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E8E4DC] p-8 text-center">
            <Plug size={32} className="mx-auto text-[#D4CFC8] mb-3" />
            <p className="text-sm text-[#8A8680]">Aucune intégration connectée pour ce tenant.</p>
          </div>
        )}

        {integrations && integrations.length > 0 && (
          <div className="flex flex-col gap-3">
            {integrations.map((intg) => (
              <div key={intg.id} className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("text-xs font-medium px-2 py-1 rounded-lg", TYPE_COLORS[intg.type] ?? "bg-[#F0EDE6] text-[#4B4846]")}>
                      {TYPE_LABELS[intg.type] ?? intg.type}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[#0F0F0D]">{intg.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {intg.status === "connected"
                          ? <CheckCircle size={11} className="text-[#1A9E68]" />
                          : <XCircle size={11} className="text-[#D64B4B]" />}
                        <span className="text-xs text-[#8A8680]">
                          {intg.status === "connected" ? "Connectée" : intg.status === "error" ? "Erreur" : "Déconnectée"}
                          {" · "}Ajoutée le {new Date(intg.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedId(expandedId === intg.id ? null : intg.id)}
                      className="flex items-center gap-1 text-xs text-[#8A8680] hover:text-[#4B4846] transition-colors px-2 py-1 rounded-lg hover:bg-[#F0EDE6]"
                    >
                      <Users size={13} />
                      Agents
                      {expandedId === intg.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <button
                      onClick={() => deleteMut.mutate(intg.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8A8680] hover:text-[#D64B4B] hover:bg-[#FFF0F0] transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {expandedId === intg.id && selectedCompanyId && (
                  <PermissionsPanel companyId={selectedCompanyId} integration={intg} push={push} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && selectedCompanyId && (
        <CreateIntegrationDialog
          companyId={selectedCompanyId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {}}
          push={push}
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
