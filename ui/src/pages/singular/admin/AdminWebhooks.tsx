import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { webhookEndpointsApi, type WebhookEndpoint, type RoutingRule, type WebhookSourceHint } from "@/api/webhookEndpoints"
import { agentsApi } from "@/api/agents"
import type { Agent } from "@paperclipai/shared"
import { adminApi } from "@/api/admin"
import {
  Webhook, Plus, Trash2, Copy, Check, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Loader2, ArrowRight, Eye, EyeOff,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Toast ─────────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = React.useState<{ id: number; msg: string; tone: "success" | "error" }[]>([])
  const push = React.useCallback((msg: string, tone: "success" | "error") => {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
  }, [])
  return { toasts, push }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<WebhookSourceHint, string> = {
  indeed:   "Indeed",
  calendly: "Calendly",
  slack:    "Slack",
  github:   "GitHub",
  stripe:   "Stripe",
  custom:   "Personnalisé",
}

const SOURCE_COLORS: Record<WebhookSourceHint, string> = {
  indeed:   "bg-[#EFF3FB] text-[#1A4E8C]",
  calendly: "bg-[#E6F5EE] text-[#1A9E68]",
  slack:    "bg-[#FEF3E2] text-[#C97C0A]",
  github:   "bg-[#F0EDE6] text-[#4B4846]",
  stripe:   "bg-[#F5EEF8] text-[#7B3FA0]",
  custom:   "bg-[#F0EDE6] text-[#4B4846]",
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 text-xs text-[#8A8680] hover:text-[#0F0F0D] transition-colors px-1.5 py-0.5 rounded hover:bg-[#F0EDE6]"
    >
      {copied ? <Check size={11} className="text-[#1A9E68]" /> : <Copy size={11} />}
      {copied ? "Copié" : "Copier"}
    </button>
  )
}

// ── Routing rule editor ───────────────────────────────────────────────────────

interface RuleEditorProps {
  rules: RoutingRule[]
  agents: Agent[]
  onChange: (rules: RoutingRule[]) => void
}

function RuleEditor({ rules, agents, onChange }: RuleEditorProps) {
  function updateRule(i: number, patch: Partial<RoutingRule>) {
    const next = rules.map((r, idx) => idx === i ? { ...r, ...patch } : r)
    onChange(next)
  }

  function addRule() {
    onChange([...rules, { action: { type: "heartbeat" } }])
  }

  function removeRule(i: number) {
    onChange(rules.filter((_, idx) => idx !== i))
  }

  return (
    <div className="flex flex-col gap-2">
      {rules.map((rule, i) => (
        <div key={i} className="bg-[#FAFAF8] rounded-xl border border-[#E8E4DC] p-3 flex flex-col gap-3">
          {/* Condition (optional) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#8A8680] w-16 flex-shrink-0">Si</span>
            <input
              type="text"
              value={rule.condition?.field ?? ""}
              onChange={(e) => updateRule(i, { condition: { ...rule.condition, field: e.target.value, op: rule.condition?.op ?? "eq" } })}
              placeholder="champ (ex: status)"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-xs outline-none"
              style={{ borderColor: "#E8E4DC" }}
            />
            <select
              value={rule.condition?.op ?? "eq"}
              onChange={(e) => updateRule(i, { condition: { ...rule.condition, field: rule.condition?.field ?? "", op: e.target.value as "eq" | "contains" | "exists" } })}
              className="px-2.5 py-1.5 rounded-lg border text-xs outline-none appearance-none bg-white"
              style={{ borderColor: "#E8E4DC" }}
            >
              <option value="eq">= égal</option>
              <option value="contains">contient</option>
              <option value="exists">existe</option>
            </select>
            {rule.condition?.op !== "exists" && (
              <input
                type="text"
                value={rule.condition?.value ?? ""}
                onChange={(e) => updateRule(i, { condition: { ...rule.condition!, field: rule.condition?.field ?? "", op: rule.condition?.op ?? "eq", value: e.target.value } })}
                placeholder="valeur"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-xs outline-none"
                style={{ borderColor: "#E8E4DC" }}
              />
            )}
          </div>

          {/* Action */}
          <div className="flex items-center gap-2 flex-wrap">
            <ArrowRight size={13} className="text-[#8A8680] flex-shrink-0" />
            <select
              value={rule.action.type}
              onChange={(e) => updateRule(i, { action: { ...rule.action, type: e.target.value as "heartbeat" | "log_only" } })}
              className="px-2.5 py-1.5 rounded-lg border text-xs outline-none appearance-none bg-white"
              style={{ borderColor: "#E8E4DC" }}
            >
              <option value="heartbeat">Déclencher un agent</option>
              <option value="log_only">Journaliser seulement</option>
            </select>
            {rule.action.type === "heartbeat" && (
              <select
                value={rule.action.agentId ?? ""}
                onChange={(e) => updateRule(i, { action: { ...rule.action, agentId: e.target.value || undefined } })}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-xs outline-none appearance-none bg-white"
                style={{ borderColor: "#E8E4DC" }}
              >
                <option value="">— Choisir un agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => removeRule(i)}
              className="ml-auto text-[#D64B4B] hover:bg-[#FFF0F0] p-1 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={addRule}
        className="flex items-center gap-1.5 text-xs text-[#8A8680] hover:text-[#0F0F0D] transition-colors px-2 py-1.5 rounded-lg hover:bg-[#F0EDE6] self-start"
      >
        <Plus size={13} />
        Ajouter une règle de routage
      </button>
    </div>
  )
}

// ── Create dialog ─────────────────────────────────────────────────────────────

interface CreateDialogProps {
  companyId: string
  agents: Agent[]
  onClose: () => void
  push: (msg: string, tone: "success" | "error") => void
}

function CreateDialog({ companyId, agents, onClose, push }: CreateDialogProps) {
  const [name, setName] = React.useState("")
  const [sourceHint, setSourceHint] = React.useState<WebhookSourceHint>("custom")
  const [secret, setSecret] = React.useState("")
  const [showSecret, setShowSecret] = React.useState(false)
  const [rules, setRules] = React.useState<RoutingRule[]>([{ action: { type: "heartbeat" } }])
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: () => webhookEndpointsApi.create(companyId, {
      name,
      sourceHint,
      secret: secret || undefined,
      routingRules: rules,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "webhooks", companyId] })
      push("Endpoint créé", "success")
      onClose()
    },
    onError: () => push("Erreur lors de la création", "error"),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-5 my-4">
        <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">Nouvel endpoint webhook</h2>

        <div>
          <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Nom</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Candidatures Indeed, Réunions Calendly…"
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
            style={{ borderColor: "#E8E4DC" }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Source</label>
          <select
            value={sourceHint}
            onChange={(e) => setSourceHint(e.target.value as WebhookSourceHint)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none appearance-none bg-white"
            style={{ borderColor: "#E8E4DC" }}
          >
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B4846] mb-1.5">Secret HMAC (optionnel)</label>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Pour valider la signature des payloads"
              className="w-full px-3 py-2.5 pr-9 rounded-xl border text-sm outline-none font-mono"
              style={{ borderColor: "#E8E4DC" }}
            />
            <button
              type="button"
              onClick={() => setShowSecret((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8680]"
            >
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B4846] mb-2">Règles de routage</label>
          <RuleEditor rules={rules} agents={agents} onChange={setRules} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-[#4B4846] hover:bg-[#F0EDE6]">
            Annuler
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={!name.trim() || mut.isPending}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[#0F0F0D] text-white disabled:opacity-40 flex items-center gap-1.5"
          >
            {mut.isPending && <Loader2 size={13} className="animate-spin" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Endpoint card ─────────────────────────────────────────────────────────────

interface EndpointCardProps {
  endpoint: WebhookEndpoint
  agents: Agent[]
  companyId: string
  push: (msg: string, tone: "success" | "error") => void
}

function EndpointCard({ endpoint, agents, companyId, push }: EndpointCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const [editingRules, setEditingRules] = React.useState(false)
  const [rules, setRules] = React.useState<RoutingRule[]>(endpoint.routingRules)
  const qc = useQueryClient()

  const inboundUrl = `${window.location.origin}/webhooks/${endpoint.id}`

  const toggleMut = useMutation({
    mutationFn: () => webhookEndpointsApi.update(companyId, endpoint.id, { isActive: !endpoint.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "webhooks", companyId] }),
    onError: () => push("Erreur lors de la mise à jour", "error"),
  })

  const saveRulesMut = useMutation({
    mutationFn: () => webhookEndpointsApi.update(companyId, endpoint.id, { routingRules: rules }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "webhooks", companyId] })
      push("Règles sauvegardées", "success")
      setEditingRules(false)
    },
    onError: () => push("Erreur lors de la sauvegarde", "error"),
  })

  const deleteMut = useMutation({
    mutationFn: () => webhookEndpointsApi.remove(companyId, endpoint.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "webhooks", companyId] })
      push("Endpoint supprimé", "success")
    },
    onError: () => push("Erreur lors de la suppression", "error"),
  })

  const agentName = (id?: string) => agents.find((a) => a.id === id)?.name ?? id ?? "—"

  return (
    <div className={cn("bg-white rounded-2xl border shadow-sm", endpoint.isActive ? "border-[#E8E4DC]" : "border-[#E8E4DC] opacity-60")}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn("text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0", SOURCE_COLORS[endpoint.sourceHint])}>
            {SOURCE_LABELS[endpoint.sourceHint]}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#0F0F0D] truncate">{endpoint.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <code className="text-xs text-[#8A8680] font-mono truncate">{inboundUrl}</code>
              <CopyButton text={inboundUrl} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-[#8A8680]">
            {endpoint.routingRules.length} règle{endpoint.routingRules.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => { setExpanded((e) => !e); if (!expanded) setEditingRules(false) }}
            className="flex items-center gap-1 text-xs text-[#8A8680] hover:text-[#0F0F0D] px-2 py-1 rounded-lg hover:bg-[#F0EDE6] transition-colors"
          >
            Règles {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            onClick={() => toggleMut.mutate()}
            className="text-[#8A8680] hover:text-[#0F0F0D] transition-colors"
            title={endpoint.isActive ? "Désactiver" : "Activer"}
          >
            {endpoint.isActive
              ? <ToggleRight size={20} className="text-[#1A9E68]" />
              : <ToggleLeft size={20} />}
          </button>
          <button
            onClick={() => deleteMut.mutate()}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8A8680] hover:text-[#D64B4B] hover:bg-[#FFF0F0] transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Routing rules panel */}
      {expanded && (
        <div className="border-t border-[#F0EDE6] px-4 py-4 flex flex-col gap-3">
          {!editingRules ? (
            <>
              {endpoint.routingRules.length === 0 && (
                <p className="text-xs text-[#8A8680]">Aucune règle de routage — tous les payloads sont journalisés.</p>
              )}
              {endpoint.routingRules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[#4B4846] flex-wrap">
                  {rule.condition ? (
                    <span className="bg-[#F0EDE6] px-2 py-0.5 rounded font-mono">
                      {rule.condition.field} {rule.condition.op} {rule.condition.value ?? ""}
                    </span>
                  ) : (
                    <span className="text-[#8A8680]">Toujours</span>
                  )}
                  <ArrowRight size={12} className="text-[#8A8680]" />
                  <span className={cn("px-2 py-0.5 rounded font-medium",
                    rule.action.type === "heartbeat" ? "bg-[#E6F5EE] text-[#1A9E68]" : "bg-[#F0EDE6] text-[#4B4846]"
                  )}>
                    {rule.action.type === "heartbeat"
                      ? `→ ${agentName(rule.action.agentId)}`
                      : "Journaliser"}
                  </span>
                </div>
              ))}
              <button
                onClick={() => { setEditingRules(true); setRules(endpoint.routingRules) }}
                className="self-start text-xs text-[#8A8680] hover:text-[#0F0F0D] px-2 py-1 rounded-lg hover:bg-[#F0EDE6] transition-colors"
              >
                Modifier les règles
              </button>
            </>
          ) : (
            <>
              <RuleEditor rules={rules} agents={agents} onChange={setRules} />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditingRules(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#4B4846] hover:bg-[#F0EDE6]"
                >
                  Annuler
                </button>
                <button
                  onClick={() => saveRulesMut.mutate()}
                  disabled={saveRulesMut.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0F0F0D] text-white disabled:opacity-40 flex items-center gap-1.5"
                >
                  {saveRulesMut.isPending && <Loader2 size={12} className="animate-spin" />}
                  Sauvegarder
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminWebhooks() {
  const { toasts, push } = useToast()
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string | null>(null)
  const [showCreate, setShowCreate] = React.useState(false)

  const { data: tenants } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants().then((r) => r.tenants),
  })

  React.useEffect(() => {
    if (tenants?.length && !selectedCompanyId) setSelectedCompanyId(tenants[0].id)
  }, [tenants, selectedCompanyId])

  const { data: endpoints, isLoading } = useQuery({
    queryKey: ["admin", "webhooks", selectedCompanyId],
    queryFn: () => webhookEndpointsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  })

  const { data: agents = [] } = useQuery({
    queryKey: ["admin", "agents", selectedCompanyId],
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  })

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">Webhooks entrants</h1>
            <p className="text-sm text-[#8A8680] mt-1">Endpoints inbound par tenant — payload → agent</p>
          </div>
          {selectedCompanyId && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#0F0F0D] text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={15} />
              Nouvel endpoint
            </button>
          )}
        </div>

        {/* Tenant selector */}
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

        {endpoints && endpoints.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E8E4DC] p-8 text-center">
            <Webhook size={32} className="mx-auto text-[#D4CFC8] mb-3" />
            <p className="text-sm text-[#8A8680]">Aucun endpoint webhook pour ce tenant.</p>
            <p className="text-xs text-[#B0AAA4] mt-1">
              Créez un endpoint pour recevoir des payloads d'Indeed, Calendly, Slack…
            </p>
          </div>
        )}

        {endpoints && endpoints.length > 0 && (
          <div className="flex flex-col gap-3">
            {endpoints.map((ep) => (
              <EndpointCard
                key={ep.id}
                endpoint={ep}
                agents={agents}
                companyId={selectedCompanyId!}
                push={push}
              />
            ))}
          </div>
        )}

        {/* Explainer */}
        <div className="bg-white rounded-2xl border border-[#E8E4DC] p-4">
          <p className="text-xs font-medium text-[#4B4846] mb-1">Comment ça marche</p>
          <ol className="text-xs text-[#8A8680] flex flex-col gap-1 list-decimal list-inside">
            <li>Copiez l'URL de l'endpoint et collez-la dans le service externe (Indeed, Calendly…)</li>
            <li>Quand un payload arrive, les règles de routage sont évaluées dans l'ordre</li>
            <li>La première règle qui correspond déclenche l'action (heartbeat agent ou journalisation)</li>
            <li>Si aucune règle ne correspond, le payload est journalisé sans action</li>
          </ol>
        </div>
      </div>

      {showCreate && selectedCompanyId && (
        <CreateDialog
          companyId={selectedCompanyId}
          agents={agents}
          onClose={() => setShowCreate(false)}
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
