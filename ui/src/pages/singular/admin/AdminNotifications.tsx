import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "@/api/admin"
import { notificationsApi, type NotificationPreferences, type Notification } from "@/api/notifications"
import { Bell, Mail, Smartphone, CheckCheck } from "lucide-react"
import { cn } from "@/lib/utils"

const NOTIF_TYPE_LABELS: Record<Notification["type"], string> = {
  approval_pending: "Approbation requise",
  trust_proposal:   "Proposition d'autonomie",
  trust_downgrade:  "Trust regression",
  intelligence:     "Carte intelligence",
  agent_error:      "Erreur agent",
  budget_alert:     "Alerte budget",
}

const NOTIF_STATUS_COLORS: Record<string, string> = {
  unread:    "border-l-[#1A9E68]",
  read:      "border-l-transparent",
  dismissed: "border-l-transparent opacity-50",
}

const PREF_ROWS: { key: keyof NotificationPreferences; label: string; inappKey: keyof NotificationPreferences; emailKey: keyof NotificationPreferences }[] = [
  { key: "approvalInapp", label: "Approbation",          inappKey: "approvalInapp",     emailKey: "approvalEmail"     },
  { key: "trustInapp",    label: "Confiance",             inappKey: "trustInapp",        emailKey: "trustEmail"        },
  { key: "intelligenceInapp", label: "Intelligence",      inappKey: "intelligenceInapp", emailKey: "intelligenceEmail" },
  { key: "errorInapp",    label: "Erreurs",               inappKey: "errorInapp",        emailKey: "errorEmail"        },
  { key: "budgetInapp",   label: "Budget",                inappKey: "budgetInapp",       emailKey: "budgetEmail"       },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "w-9 h-5 rounded-full transition-colors relative flex-shrink-0",
        checked ? "bg-[#1A9E68]" : "bg-[#E8E4DC]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  )
}

function PrefsPanel({ companyId }: { companyId: string }) {
  const qc = useQueryClient()
  const { data: prefs } = useQuery({
    queryKey: ["admin", "notif-prefs", companyId],
    queryFn: () => notificationsApi.getPreferences(companyId),
    enabled: !!companyId,
  })

  const update = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      notificationsApi.updatePreferences(companyId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "notif-prefs", companyId] }),
  })

  if (!prefs) return null

  function toggle(key: keyof NotificationPreferences) {
    update.mutate({ [key]: !prefs![key] })
  }

  const uniqueRows = PREF_ROWS.filter((r, i, arr) => arr.findIndex(x => x.label === r.label) === i)

  return (
    <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3 border-b border-[#F0EDE6] text-xs text-[#8A8680]">
        <span>Type</span>
        <span className="flex items-center gap-1"><Smartphone size={12} /> In-app</span>
        <span className="flex items-center gap-1"><Mail size={12} /> Email</span>
      </div>
      {uniqueRows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3.5 border-b border-[#F0EDE6] last:border-0"
        >
          <span className="text-sm text-[#0F0F0D]">{row.label}</span>
          <Toggle checked={!!prefs[row.inappKey]} onChange={() => toggle(row.inappKey)} />
          <Toggle checked={!!prefs[row.emailKey]} onChange={() => toggle(row.emailKey)} />
        </div>
      ))}
    </div>
  )
}

function NotifRow({ n, companyId }: { n: Notification; companyId: string }) {
  const qc = useQueryClient()
  const markRead = useMutation({
    mutationFn: () => notificationsApi.markRead(companyId, n.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "notifs", companyId] }),
  })

  return (
    <div className={cn(
      "flex items-start gap-3 px-4 py-3 border-l-2 border-b border-[#F0EDE6] last:border-b-0 bg-white",
      NOTIF_STATUS_COLORS[n.status] ?? "border-l-transparent",
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F0EDE6] text-[#8A8680]">
            {NOTIF_TYPE_LABELS[n.type] ?? n.type}
          </span>
          <span className="text-xs text-[#8A8680]">{new Date(n.createdAt).toLocaleString("fr-FR")}</span>
        </div>
        <p className="text-sm font-medium text-[#0F0F0D] mt-1">{n.title}</p>
        <p className="text-xs text-[#8A8680] mt-0.5 line-clamp-2">{n.body}</p>
      </div>
      {n.status === "unread" && (
        <button
          onClick={() => markRead.mutate()}
          className="shrink-0 p-1 text-[#8A8680] hover:text-[#1A9E68] transition-colors"
          title="Marquer comme lu"
        >
          <CheckCheck size={14} />
        </button>
      )}
    </div>
  )
}

export function AdminNotifications() {
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("")
  const [tab, setTab] = React.useState<"prefs" | "history">("prefs")

  const { data: tenants } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants().then((r) => r.tenants),
  })

  React.useEffect(() => {
    if (tenants?.length && !selectedCompanyId) setSelectedCompanyId(tenants[0].id)
  }, [tenants, selectedCompanyId])

  const { data: notifsData } = useQuery({
    queryKey: ["admin", "notifs", selectedCompanyId],
    queryFn: () => notificationsApi.listAll(selectedCompanyId),
    enabled: !!selectedCompanyId && tab === "history",
  })

  const notifs = notifsData?.notifications ?? []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-serif text-[#0F0F0D]">Notifications</h1>
          <p className="text-sm text-[#8A8680] mt-1">Préférences et historique des notifications par tenant</p>
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

        {selectedCompanyId && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-5 bg-[#F0EDE6] rounded-xl p-1 w-fit">
              {(["prefs", "history"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm transition-colors",
                    tab === t ? "bg-white text-[#0F0F0D] shadow-sm font-medium" : "text-[#8A8680] hover:text-[#0F0F0D]",
                  )}
                >
                  {t === "prefs" ? "Preferences" : "History"}
                </button>
              ))}
            </div>

            {tab === "prefs" && <PrefsPanel companyId={selectedCompanyId} />}

            {tab === "history" && (
              <div className="border border-[#E8E4DC] rounded-2xl overflow-hidden">
                {notifs.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-[#8A8680] bg-white">
                    <Bell size={24} className="mx-auto mb-2 text-[#E8E4DC]" />
                    Aucune notification pour ce tenant.
                  </div>
                ) : (
                  notifs.map((n) => (
                    <NotifRow key={n.id} n={n} companyId={selectedCompanyId} />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
