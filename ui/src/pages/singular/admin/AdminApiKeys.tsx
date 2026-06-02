import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instanceApiKeysApi, type ApiKeyStatus } from "@/api/instanceApiKeys"
import { Key, Check, X, Trash2, Eye, EyeOff, Loader2, Wifi } from "lucide-react"
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

interface KeyCardProps {
  item: ApiKeyStatus
  onSave: (provider: string, value: string) => void
  onDelete: (provider: string) => void
  onTest: (provider: string) => void
  saving: boolean
  testing: boolean
  testResult: { ok: boolean; note?: string } | null
}

function KeyCard({ item, onSave, onDelete, onTest, saving, testing, testResult }: KeyCardProps) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState("")
  const [show, setShow] = React.useState(false)

  function handleSave() {
    if (!value.trim()) return
    onSave(item.provider, value.trim())
    setValue("")
    setEditing(false)
    setShow(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#F0EDE6] flex items-center justify-center flex-shrink-0 mt-0.5">
            <Key size={16} className="text-[#4B4846]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-[#0F0F0D]">{item.label}</p>
              <span className="text-xs font-mono text-[#8A8680] bg-[#F0EDE6] px-1.5 py-0.5 rounded">
                {item.envVar}
              </span>
              {item.configured ? (
                <span className={cn(
                  "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                  item.source === "db"
                    ? "bg-[#E6F5EE] text-[#1A9E68]"
                    : "bg-[#EFF3FB] text-[#1A4E8C]",
                )}>
                  <Check size={10} />
                  {item.source === "db" ? "Configured" : "Via env"}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-[#FEF3E2] text-[#C97C0A]">
                  <X size={10} />
                  Non configurée
                </span>
              )}
            </div>
            <p className="text-xs text-[#8A8680] mt-0.5">{item.description}</p>
            {item.updatedAt && (
              <p className="text-xs text-[#B0AAA4] mt-0.5">
                Mis à jour {new Date(item.updatedAt).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {item.configured && (
            <button
              onClick={() => onTest(item.provider)}
              disabled={testing}
              title="Tester la connexion"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8A8680] hover:text-[#1A4E8C] hover:bg-[#EFF3FB] transition-colors disabled:opacity-50"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
            </button>
          )}
          {item.source === "db" && (
            <button
              onClick={() => onDelete(item.provider)}
              title="Delete key"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8A8680] hover:text-[#D64B4B] hover:bg-[#FFF0F0] transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => { setEditing((e) => !e); setValue(""); setShow(false) }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E8E4DC] text-[#4B4846] hover:bg-[#F0EDE6] transition-colors"
          >
            {editing ? "Cancel" : item.configured ? "Update" : "Configure"}
          </button>
        </div>
      </div>

      {testResult && (
        <div className={cn(
          "mt-3 px-3 py-2 rounded-lg text-xs",
          testResult.ok ? "bg-[#E6F5EE] text-[#1A9E68]" : "bg-[#FFF0F0] text-[#D64B4B]",
        )}>
          {testResult.ok
            ? testResult.note ?? "Connection successful ✓"
            : `Échec de connexion : ${testResult.note ?? "Erreur inconnue"}`}
        </div>
      )}

      {editing && (
        <div className="mt-4 flex gap-2">
          <div className="flex-1 relative">
            <input
              type={show ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={`Clé ${item.label}…`}
              autoFocus
              className="w-full px-3 py-2 pr-9 rounded-xl border text-sm outline-none transition-colors font-mono"
              style={{ borderColor: "#E8E4DC", color: "#0F0F0D" }}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8680] hover:text-[#4B4846]"
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={!value.trim() || saving}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[#0F0F0D] text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      )}
    </div>
  )
}

export function AdminApiKeys() {
  const qc = useQueryClient()
  const { toasts, push } = useToast()
  const [testResults, setTestResults] = React.useState<Record<string, { ok: boolean; note?: string }>>({})
  const [testingProvider, setTestingProvider] = React.useState<string | null>(null)
  const [savingProvider, setSavingProvider] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["instance", "api-keys"],
    queryFn: () => instanceApiKeysApi.list(),
  })

  const upsertMut = useMutation({
    mutationFn: ({ provider, value }: { provider: string; value: string }) =>
      instanceApiKeysApi.upsert(provider, value),
    onSuccess: (_, { provider }) => {
      qc.invalidateQueries({ queryKey: ["instance", "api-keys"] })
      setSavingProvider(null)
      push("Key saved", "success")
    },
    onError: (_, { provider }) => {
      setSavingProvider(null)
      push("Erreur lors de l'enregistrement", "error")
    },
  })

  const deleteMut = useMutation({
    mutationFn: (provider: string) => instanceApiKeysApi.remove(provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instance", "api-keys"] })
      push("Key deleted", "success")
    },
    onError: () => push("Erreur lors de la suppression", "error"),
  })

  async function handleTest(provider: string) {
    setTestingProvider(provider)
    try {
      const result = await instanceApiKeysApi.test(provider)
      setTestResults((r) => ({ ...r, [provider]: { ok: result.ok, note: result.note ?? result.error } }))
    } catch {
      setTestResults((r) => ({ ...r, [provider]: { ok: false, note: "Network error" } }))
    } finally {
      setTestingProvider(null)
      setTimeout(() => setTestResults((r) => { const n = { ...r }; delete n[provider]; return n }), 6000)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const configured = data.filter((k) => k.configured).length

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">Clés API</h1>
          <p className="text-sm text-[#8A8680] mt-1">
            {configured}/{data.length} clés configurées — les clés sont chiffrées AES-256-GCM et jamais exposées.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {data.map((item) => (
            <KeyCard
              key={item.provider}
              item={item}
              onSave={(p, v) => { setSavingProvider(p); upsertMut.mutate({ provider: p, value: v }) }}
              onDelete={(p) => deleteMut.mutate(p)}
              onTest={handleTest}
              saving={savingProvider === item.provider}
              testing={testingProvider === item.provider}
              testResult={testResults[item.provider] ?? null}
            />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E4DC] p-4">
          <p className="text-xs text-[#8A8680]">
            Les clés configurées ici prennent le dessus sur les variables d'environnement.
            Redémarrage serveur non requis.
          </p>
        </div>
      </div>

      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg",
              t.tone === "success"
                ? "bg-[#0F0F0D] text-white"
                : "bg-[#D64B4B] text-white",
            )}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
