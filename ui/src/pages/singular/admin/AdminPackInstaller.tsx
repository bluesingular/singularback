/**
 * Screen D — Pack management (install / uninstall) for the Swwarm admin team.
 * Route: /instance/admin/packs
 */

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Package, CheckCircle2, Loader2, Trash2, Users, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { adminApi } from "../../../api/admin.js"
import { AdminDialog } from "./AdminDialog"

// ── P1 hardcoded manifest (from packs/p1-recruitment/manifest.json) ───────────

const P1_PACK = {
  slug: "p1-recruitment",
  name: "Recruitment agency",
  version: "1.0.0",
  description: "Automate CV qualification, candidate sourcing, client follow-up, and weekly reporting for recruitment agencies. Live in 20 minutes.",
  agentCount: 5,
  skillCount: 7,
  dna_extensions: {
    specialisation: { label: "Main specialisation (e.g. IT & Digital, Finance, Healthcare)", type: "string" },
    zone_geo:       { label: "Primary geographic zone", type: "string" },
    nb_consultants: { label: "Number of consultants", type: "enum", values: ["1", "2-5", "6-15", "16-50"] },
    billing_model:  { label: "Billing model", type: "enum", values: ["success_fee", "fixed_fee", "retainer", "mixed"] },
    avg_salary_range: { label: "Typical salary range placed", type: "string" },
    client_type:    { label: "Main client types", type: "string" },
  },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AvailablePack {
  slug: string
  name: string
  version: string
  description: string
  agentCount: number
  skillCount: number
  dna_extensions: Record<string, { label: string; type: string; values?: string[] }>
}

interface InstalledPack {
  id: string
  companyId: string
  companyName: string
  packSlug: string
  packVersion: string
  installedAt: string
  status: "active" | "error" | "uninstalling"
}

// ── Install modal ─────────────────────────────────────────────────────────────

function InstallModal({
  pack,
  tenants,
  onClose,
  onInstall,
  installing,
}: {
  pack: AvailablePack
  tenants: { id: string; name: string }[]
  onClose: () => void
  onInstall: (companyId: string, dna: Record<string, string>) => void
  installing: boolean
}) {
  const [selectedTenant, setSelectedTenant] = React.useState("")
  const [dnaValues, setDnaValues] = React.useState<Record<string, string>>({})

  const dnaFields = Object.entries(pack.dna_extensions)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTenant) return
    onInstall(selectedTenant, dnaValues)
  }

  return (
    <AdminDialog open={true} onClose={onClose} title={`Installer ${pack.name}`} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-[#8A8680]">v{pack.version}</p>

        {/* Tenant selector */}
        <div>
          <label className="text-xs font-medium text-[#8A8680] mb-1 block">Tenant cible</label>
          <select
            value={selectedTenant}
            onChange={e => setSelectedTenant(e.target.value)}
            required
            className="w-full text-sm border border-[#E8E4DC] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] bg-white"
          >
            <option value="">Sélectionner un tenant…</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* DNA extension questions */}
        {dnaFields.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wider">
              Configuration du pack
            </p>
            {dnaFields.map(([key, field]) => (
              <div key={key}>
                <label className="text-xs font-medium text-[#8A8680] mb-1 block">{field.label}</label>
                {field.type === "enum" && field.values ? (
                  <select
                    value={dnaValues[key] ?? ""}
                    onChange={e => setDnaValues(v => ({ ...v, [key]: e.target.value }))}
                    className="w-full text-sm border border-[#E8E4DC] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] bg-white"
                  >
                    <option value="">Sélectionner…</option>
                    {field.values.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input
                    value={dnaValues[key] ?? ""}
                    onChange={e => setDnaValues(v => ({ ...v, [key]: e.target.value }))}
                    placeholder={field.label}
                    className="w-full text-sm border border-[#E8E4DC] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t border-[#E8E4DC]">
          <button
            type="submit"
            disabled={!selectedTenant || installing}
            className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#1A9E68] hover:bg-[#158a5a] px-4 py-2 rounded-xl transition-colors disabled:opacity-40"
          >
            {installing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {installing ? "Installation…" : "Installer"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-[#8A8680] hover:text-[#0F0F0D] px-4 py-2 rounded-xl transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </AdminDialog>
  )
}

// ── Available pack card ───────────────────────────────────────────────────────

function PackCard({ pack, onInstall }: { pack: AvailablePack; onInstall: (p: AvailablePack) => void }) {
  return (
    <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0F0F0D]">{pack.name}</p>
          <p className="text-xs text-[#8A8680] mt-0.5">v{pack.version}</p>
        </div>
        <span className="text-xs bg-[#E8F7F0] text-[#1A9E68] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
          {pack.slug}
        </span>
      </div>

      <p className="text-xs text-[#8A8680] leading-relaxed">{pack.description}</p>

      <div className="flex items-center gap-4 text-xs text-[#8A8680]">
        <span className="flex items-center gap-1">
          <Users size={11} />
          {pack.agentCount} agents
        </span>
        <span className="flex items-center gap-1">
          <Zap size={11} />
          {pack.skillCount} compétences
        </span>
      </div>

      <button
        onClick={() => onInstall(pack)}
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-[#0F0F0D] hover:bg-[#1A1A18] px-4 py-2 rounded-xl transition-colors"
      >
        <Package size={13} />
        Installer
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminPackInstaller() {
  const queryClient = useQueryClient()
  const [installTarget, setInstallTarget] = React.useState<AvailablePack | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [uploadError, setUploadError] = React.useState("")
  const [uploadSuccess, setUploadSuccess] = React.useState("")
  const uploadRef = React.useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: async (packJson: object) =>
      adminApi.post("/admin/packs/upload", packJson),
    onSuccess: (_, vars: any) => {
      setUploadSuccess(`Pack "${vars.slug ?? vars.name}" ajouté avec succès.`)
      setUploadError("")
      queryClient.invalidateQueries({ queryKey: ["admin-available-packs"] })
      setTimeout(() => setUploadSuccess(""), 4000)
    },
    onError: (err: unknown) => {
      setUploadError(err instanceof Error ? err.message : "Erreur lors de l'upload")
    },
  })

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse((ev.target?.result as string) ?? "{}")
        uploadMutation.mutate(json)
      } catch {
        setUploadError("Fichier JSON invalide")
      }
    }
    reader.readAsText(file)
    // Reset input so same file can be re-uploaded
    e.target.value = ""
  }

  const tenantsQuery = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => adminApi.listTenants().then(r => r.tenants),
    staleTime: 60_000,
  })

  // Fetch available packs from API, fall back to P1 hardcoded
  const availableQuery = useQuery({
    queryKey: ["admin-available-packs"],
    queryFn: () =>
      adminApi.get<{ ok: true; data: { packs: AvailablePack[] } }>("/admin/packs")
        .then(r => ({ packs: r.data.packs }))
        .catch(() => ({ packs: [P1_PACK as AvailablePack] })),
    staleTime: 300_000,
  })

  const installedQuery = useQuery({
    queryKey: ["admin-installed-packs"],
    queryFn: () =>
      adminApi.get<{ ok: true; data: { installations: InstalledPack[] } }>("/admin/packs/installations")
        .then(r => ({ installations: r.data.installations }))
        .catch(() => ({ installations: [] as InstalledPack[] })),
    staleTime: 30_000,
  })

  const installMutation = useMutation({
    mutationFn: ({ companyId, packSlug, dna }: { companyId: string; packSlug: string; dna: Record<string, string> }) =>
      adminApi.post(`/admin/companies/${companyId}/packs/install`, { packSlug, dnaExtensions: dna }),
    onSuccess: () => {
      setInstallTarget(null)
      queryClient.invalidateQueries({ queryKey: ["admin-installed-packs"] })
    },
  })

  const uninstallMutation = useMutation({
    mutationFn: ({ companyId, packSlug }: { companyId: string; packSlug: string }) =>
      adminApi.delete(`/admin/companies/${companyId}/packs/${packSlug}`),
    onMutate: ({ companyId, packSlug }) => setBusyId(`${companyId}-${packSlug}`),
    onSettled: () => {
      setBusyId(null)
      queryClient.invalidateQueries({ queryKey: ["admin-installed-packs"] })
    },
  })

  const availablePacks = availableQuery.data?.packs ?? [P1_PACK as AvailablePack]
  const installations = installedQuery.data?.installations ?? []
  const tenants = tenantsQuery.data ?? []

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Package size={16} className="text-[#8A8680]" />
              <h1 className="text-2xl font-serif font-semibold text-[#0F0F0D]">Packs</h1>
            </div>
            <p className="text-sm text-[#8A8680]">
              Gestion des packs disponibles et de leur installation par tenant.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <input ref={uploadRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
            <button
              onClick={() => { setUploadError(""); uploadRef.current?.click(); }}
              disabled={uploadMutation.isPending}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-colors",
                "text-white bg-[#1A9E68] hover:bg-[#158a5a] disabled:opacity-40"
              )}
            >
              {uploadMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
              {uploadMutation.isPending ? "Upload…" : "Upload pack.json"}
            </button>
            {uploadError && <p className="text-xs text-red-600 max-w-xs text-right">{uploadError}</p>}
            {uploadSuccess && <p className="text-xs text-[#1A9E68] max-w-xs text-right">{uploadSuccess}</p>}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-2 gap-6 items-start">

          {/* Left: available packs */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-[#0F0F0D]">Packs disponibles</h2>
            {availableQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-[#8A8680]">
                <Loader2 size={14} className="animate-spin" /> Chargement…
              </div>
            ) : (
              availablePacks.map(p => (
                <PackCard key={p.slug} pack={p} onInstall={setInstallTarget} />
              ))
            )}
          </div>

          {/* Right: installations per tenant */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-[#0F0F0D]">Installés par tenant</h2>
            <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
              {installedQuery.isLoading && (
                <div className="flex items-center gap-2 px-5 py-4 text-sm text-[#8A8680]">
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </div>
              )}
              {installations.length === 0 && !installedQuery.isLoading && (
                <p className="px-5 py-8 text-sm text-[#8A8680] text-center">
                  Aucun pack installé pour l'instant.
                </p>
              )}
              {installations.map(inst => (
                <div
                  key={inst.id}
                  className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F0EDE6] last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-[#0F0F0D] truncate">{inst.companyName}</span>
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0",
                        inst.status === "active"      ? "bg-[#E8F7F0] text-[#1A9E68]"  :
                        inst.status === "error"       ? "bg-[#FEF2F2] text-red-600"     :
                                                        "bg-[#FFF8EC] text-[#C97C0A]",
                      )}>
                        {inst.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#8A8680]">
                      {inst.packSlug} v{inst.packVersion}
                      {" · "}installé {new Date(inst.installedAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <button
                    onClick={() => uninstallMutation.mutate({ companyId: inst.companyId, packSlug: inst.packSlug })}
                    disabled={busyId === `${inst.companyId}-${inst.packSlug}`}
                    className="text-[#8A8680] hover:text-red-600 transition-colors flex-shrink-0 disabled:opacity-40"
                    title="Désinstaller"
                  >
                    {busyId === `${inst.companyId}-${inst.packSlug}`
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />
                    }
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Install modal */}
      {installTarget && (
        <InstallModal
          pack={installTarget}
          tenants={tenants}
          onClose={() => setInstallTarget(null)}
          onInstall={(companyId, dna) =>
            installMutation.mutate({ companyId, packSlug: installTarget.slug, dna })
          }
          installing={installMutation.isPending}
        />
      )}
    </div>
  )
}
