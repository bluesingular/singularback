/**
 * Gap D — Admin skill list.
 *
 * Tab 1: "File d'approbation" — pending approval queue + version browser
 * Tab 2: "Compétences maîtres" — master skill list, edit, tenant lineage, pending updates
 */

import * as React from "react"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@/lib/router"
import {
  CheckCircle2, XCircle, Clock, ChevronRight, Search, Loader2,
  GitBranch, Star, Play, AlertTriangle, ChevronDown, Pencil,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { adminApi, MasterSkill, TenantCopy, SkillUpdateNotification } from "../../../api/admin.js"
import { AdminDialog } from "./AdminDialog"

// ── Regression result type ────────────────────────────────────────────────────

interface RegressionResult {
  examplesRun:          number
  passed:               number
  avgJudgeCandidate:    number
  avgJudgeBaseline:     number
  delta:                number
  promoted:             boolean
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft:            "bg-[#F5F5F3] text-[#6B7280]",
  review:           "bg-[#EEF4FF] text-[#1A4E8C]",
  staging:          "bg-[#FFF8EC] text-[#C97C0A]",
  active:           "bg-[#E8F7F0] text-[#1A9E68]",
  pending_approval: "bg-[#FEF3E0] text-[#C97C0A]",
  blocked:          "bg-[#FEF2F2] text-red-600",
  deprecated:       "bg-[#F5F5F3] text-[#9CA3AF]",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_COLORS[status] ?? "bg-[#F5F5F3] text-[#6B7280]")}>
      {status.replace("_", " ")}
    </span>
  )
}

// ── Pending version row ───────────────────────────────────────────────────────

interface PendingVersion {
  id: string
  companyId: string
  skillType: string
  version: string
  status: string
  benchmarkScore: string | null
  triggerReason: string | null
  createdAt: string
  companyName: string
}

function PendingRow({ v, onApprove, onReject, busy }: {
  v: PendingVersion
  onApprove: (id: string) => void
  onReject:  (id: string) => void
  busy: boolean
}) {
  const [regression, setRegression] = React.useState<RegressionResult | null>(null)
  const [testRunning, setTestRunning] = React.useState(false)
  const [testError, setTestError] = React.useState<string | null>(null)

  async function runRegressionTest() {
    setTestRunning(true)
    setTestError(null)
    try {
      const res = await adminApi.post<RegressionResult>(
        `/admin/skills/_/versions/${v.id}/regression-test`,
      )
      setRegression(res)
    } catch {
      setTestError("Tests non disponibles")
    } finally {
      setTestRunning(false)
    }
  }

  const regressionBlocked = regression && regression.delta < -0.5

  return (
    <div className="border-b border-[#F0EDE6] last:border-0">
      <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAFAF8] transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <GitBranch size={13} className="text-[#8A8680] flex-shrink-0" />
            <span className="text-sm font-medium text-[#0F0F0D] truncate">{v.skillType}</span>
            <span className="text-xs text-[#8A8680]">v{v.version}</span>
            <StatusBadge status={v.status} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-[#8A8680]">
            <span>{v.companyName}</span>
            {v.benchmarkScore != null && (
              <span className="flex items-center gap-1">
                <Star size={11} />
                {parseFloat(v.benchmarkScore).toFixed(2)}
              </span>
            )}
            <span>{v.triggerReason ?? "manual"}</span>
          </div>

          {!regression && !testError && (
            <button
              onClick={runRegressionTest}
              disabled={testRunning}
              className="flex items-center gap-1 text-xs text-[#8A8680] hover:text-[#1A4E8C] mt-1.5 transition-colors"
            >
              {testRunning
                ? <Loader2 size={11} className="animate-spin" />
                : <Play size={11} />
              }
              {testRunning ? "Tests en cours…" : "Lancer les tests"}
            </button>
          )}
          {testError && (
            <span className="text-xs text-[#8A8680] mt-1 block">{testError}</span>
          )}
          {regression && (
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              <span className="text-[#0F0F0D]">
                Tests : <strong>{regression.passed}/{regression.examplesRun}</strong> passés
                {" · "}score moyen : <strong>{regression.avgJudgeCandidate.toFixed(1)}</strong>
              </span>
              {regressionBlocked && (
                <span className="flex items-center gap-1 text-red-600 font-medium">
                  <AlertTriangle size={11} />
                  Régression détectée — delta : {regression.delta.toFixed(2)}
                </span>
              )}
              {!regressionBlocked && regression.delta !== 0 && (
                <span className={cn("font-medium", regression.delta > 0 ? "text-[#1A9E68]" : "text-[#C97C0A]")}>
                  delta : {regression.delta > 0 ? "+" : ""}{regression.delta.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            title={regressionBlocked ? `Régression détectée — delta score : ${regression?.delta.toFixed(2)}` : undefined}
          >
            <button
              onClick={() => onApprove(v.id)}
              disabled={busy || !!regressionBlocked}
              className="flex items-center gap-1.5 text-xs font-medium text-[#1A9E68] hover:bg-[#E8F7F0] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              <CheckCircle2 size={13} />
              Approuver
            </button>
          </div>
          <button
            onClick={() => onReject(v.id)}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            <XCircle size={13} />
            Rejeter
          </button>
        </div>
      </div>
    </div>
  )
}

// ── New version dialog ────────────────────────────────────────────────────────

function NewVersionDialog({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (skillType: string, versionId: string, companyId: string) => void
}) {
  const [companyId, setCompanyId]   = useState("")
  const [skillType, setSkillType]   = useState("")
  const [version, setVersion]       = useState("1.0.0")
  const [promptBody, setPromptBody] = useState("# Instructions\n\n")
  const [error, setError]           = useState("")

  const create = useMutation({
    mutationFn: () =>
      adminApi.post<{ version: { id: string } }>(
        `/admin/skills/${skillType.trim()}/versions?companyId=${companyId.trim()}`,
        { version: version.trim(), promptBody: promptBody.trim(), triggerReason: "manual" },
      ),
    onSuccess: (data) => onCreated(skillType.trim(), data.version.id, companyId.trim()),
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Erreur lors de la création"),
  })

  const valid = companyId.trim().length > 10 && skillType.trim().length > 1 && version.trim().length > 0

  return (
    <AdminDialog open title="Nouvelle version de compétence" onClose={onClose} maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[#4B4846] mb-1 block">Company ID *</label>
            <input
              type="text"
              value={companyId}
              onChange={e => { setCompanyId(e.target.value); setError("") }}
              placeholder="UUID de la company"
              className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#4B4846] mb-1 block">Type de compétence *</label>
            <input
              type="text"
              value={skillType}
              onChange={e => { setSkillType(e.target.value); setError("") }}
              placeholder="ex: qualification-cv"
              className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[#4B4846] mb-1 block">Version *</label>
          <input
            type="text"
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder="1.0.0"
            className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#4B4846] mb-1 block">Instructions initiales *</label>
          <textarea
            value={promptBody}
            onChange={e => setPromptBody(e.target.value)}
            rows={6}
            className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1A9E68] resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-[#E8E4DC] mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A8680] hover:text-[#0F0F0D]">Annuler</button>
        <button
          onClick={() => create.mutate()}
          disabled={!valid || create.isPending}
          className="px-4 py-2 text-sm bg-[#1A9E68] text-white rounded-lg hover:bg-[#158a5a] disabled:opacity-50 transition-colors"
        >
          {create.isPending ? "Création…" : "Créer et éditer"}
        </button>
      </div>
    </AdminDialog>
  )
}

// ── Master skills helpers ─────────────────────────────────────────────────────

const TIER_BADGE: Record<number, string> = {
  0: "bg-[#F5F5F3] text-[#6B7280]",
  1: "bg-[#EEF4FF] text-[#1A4E8C]",
  2: "bg-[#FFF8EC] text-[#C97C0A]",
  3: "bg-[#F3EEFF] text-[#7C3AED]",
}

function TierBadge({ tier }: { tier: number }) {
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", TIER_BADGE[tier] ?? TIER_BADGE[0])}>
      Tier {tier}
    </span>
  )
}

function GdprPill() {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">RGPD</span>
  )
}

function AiActBadge({ risk }: { risk: string }) {
  if (risk === "high") {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">Haut risque</span>
  }
  if (risk === "limited") {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#F5F5F3] text-[#6B7280]">Limité</span>
  }
  return null
}

// ── Edit master skill dialog ──────────────────────────────────────────────────

function EditMasterSkillDialog({ skill, onClose, onSuccess }: {
  skill: MasterSkill
  onClose: () => void
  onSuccess: (notified: number) => void
}) {
  const [version, setVersion]     = useState(skill.masterVersion ?? "1.0.0")
  const [changelog, setChangelog] = useState("")
  const [markdown, setMarkdown]   = useState(skill.markdown)
  const [error, setError]         = useState("")

  const save = useMutation({
    mutationFn: () =>
      adminApi.patch<{ notified: number }>(`/admin/skills/master/${skill.id}`, { markdown, version, changelog }),
    onSuccess: (data) => onSuccess(data.notified),
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde"),
  })

  return (
    <AdminDialog open title="Mettre à jour la compétence maître" onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[#4B4846] mb-1 block">Version *</label>
            <input
              type="text"
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="1.1.0"
              className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#4B4846] mb-1 block">Slug</label>
            <input
              type="text"
              value={skill.slug}
              disabled
              className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm bg-[#FAFAF8] text-[#8A8680]"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[#4B4846] mb-1 block">Changelog</label>
          <textarea
            value={changelog}
            onChange={e => setChangelog(e.target.value)}
            rows={2}
            placeholder="Résumé des changements…"
            className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A9E68] resize-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#4B4846] mb-1 block">Markdown *</label>
          <textarea
            value={markdown}
            onChange={e => setMarkdown(e.target.value)}
            rows={14}
            className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1A9E68] resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-[#E8E4DC] mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A8680] hover:text-[#0F0F0D]">Annuler</button>
        <button
          onClick={() => save.mutate()}
          disabled={!version.trim() || !markdown.trim() || save.isPending}
          className="px-4 py-2 text-sm bg-[#1A9E68] text-white rounded-lg hover:bg-[#158a5a] disabled:opacity-50 transition-colors"
        >
          {save.isPending ? "Sauvegarde…" : "Mettre à jour"}
        </button>
      </div>
    </AdminDialog>
  )
}

// ── Master skill row (expandable) ─────────────────────────────────────────────

function MasterSkillRow({ skill, onEdit }: {
  skill: MasterSkill & { tenantCount?: number }
  onEdit: (skill: MasterSkill) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()

  const tenantsQuery = useQuery({
    queryKey: ["master-skill-tenants", skill.id],
    queryFn: () => adminApi.get<{ copies: TenantCopy[] }>(`/admin/skills/master/${skill.id}/tenants`).then(r => r.copies),
    enabled: expanded,
    staleTime: 30_000,
  })

  const copyMutation = useMutation({
    mutationFn: (companyId: string) =>
      adminApi.post(`/admin/skills/master/${skill.id}/copy`, { companyId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["master-skill-tenants", skill.id] }),
  })

  return (
    <div className="border-b border-[#F0EDE6] last:border-0">
      {/* Row */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAF8] transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <ChevronDown
          size={14}
          className={cn("text-[#8A8680] flex-shrink-0 transition-transform", expanded && "rotate-180")}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#0F0F0D]">{skill.name}</span>
            <span className="text-xs text-[#8A8680] font-mono">{skill.slug}</span>
            <TierBadge tier={skill.tier} />
            {skill.gdprRequired && <GdprPill />}
            <AiActBadge risk={skill.aiActRisk} />
          </div>
          <p className="text-xs text-[#8A8680] mt-0.5">
            {skill.masterVersion ? `v${skill.masterVersion}` : "—"}
            {skill.tenantCount != null && ` · ${skill.tenantCount} tenant${skill.tenantCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onEdit(skill) }}
          className="flex items-center gap-1.5 text-xs font-medium text-[#4B4846] hover:bg-[#F0EDE6] px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          <Pencil size={12} />
          Éditer
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-10 pb-4 bg-[#FAFAF8] border-t border-[#F0EDE6]">
          {/* Markdown preview */}
          <div className="mt-3 mb-3">
            <p className="text-xs font-medium text-[#4B4846] mb-1">Aperçu</p>
            <pre className="text-xs text-[#4B4846] font-mono bg-white border border-[#E8E4DC] rounded-lg p-3 whitespace-pre-wrap break-words line-clamp-6 max-h-32 overflow-hidden">
              {skill.markdown.slice(0, 300)}{skill.markdown.length > 300 ? "…" : ""}
            </pre>
          </div>

          {/* Tenant copies */}
          <p className="text-xs font-medium text-[#4B4846] mb-2">Copies tenants</p>
          {tenantsQuery.isLoading && (
            <div className="flex items-center gap-2 text-xs text-[#8A8680]">
              <Loader2 size={12} className="animate-spin" /> Chargement…
            </div>
          )}
          {tenantsQuery.data?.length === 0 && (
            <p className="text-xs text-[#8A8680]">Aucun tenant n'a installé cette compétence.</p>
          )}
          {tenantsQuery.data?.map(copy => (
            <div key={copy.companyId} className="flex items-center gap-3 py-1.5 border-b border-[#F0EDE6] last:border-0">
              <span className="text-xs text-[#0F0F0D] flex-1 truncate">{copy.companyName}</span>
              <span className="text-xs text-[#8A8680]">
                {copy.masterVersion ? `v${copy.masterVersion}` : "—"}
              </span>
              <button
                onClick={() => copyMutation.mutate(copy.companyId)}
                disabled={copyMutation.isPending}
                className="text-xs font-medium text-[#1A4E8C] hover:bg-[#EEF4FF] px-2 py-1 rounded-md transition-colors disabled:opacity-40"
              >
                Mettre à jour
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pending updates panel ─────────────────────────────────────────────────────

function PendingUpdatesPanel() {
  const queryClient = useQueryClient()

  const updatesQuery = useQuery({
    queryKey: ["admin-skill-updates"],
    queryFn: () => adminApi.get<{ updates: SkillUpdateNotification[] }>("/admin/skill-updates").then(r => r.updates),
    staleTime: 30_000,
  })

  const applyMutation = useMutation({
    mutationFn: (id: string) => adminApi.post(`/admin/skill-updates/${id}/apply`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-skill-updates"] }),
  })

  const dismissMutation = useMutation({
    mutationFn: (id: string) => adminApi.post(`/admin/skill-updates/${id}/dismiss`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-skill-updates"] }),
  })

  return (
    <section className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0EDE6] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-[#C97C0A]" />
          <h2 className="text-sm font-semibold text-[#0F0F0D]">Mises à jour en attente</h2>
          {updatesQuery.data && updatesQuery.data.length > 0 && (
            <span className="text-xs bg-[#FFF8EC] text-[#C97C0A] px-2 py-0.5 rounded-full font-medium">
              {updatesQuery.data.length}
            </span>
          )}
        </div>
        {updatesQuery.isLoading && <Loader2 size={14} className="animate-spin text-[#8A8680]" />}
      </div>

      {updatesQuery.data?.length === 0 && (
        <p className="px-5 py-6 text-sm text-[#8A8680] text-center">
          Aucune mise à jour en attente.
        </p>
      )}

      {updatesQuery.data?.map(u => (
        <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#F0EDE6] last:border-0 hover:bg-[#FAFAF8] transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#0F0F0D] truncate">{u.skillName}</span>
              <span className="text-xs text-[#8A8680]">v{u.newVersion}</span>
            </div>
            <p className="text-xs text-[#8A8680] mt-0.5 truncate">{u.companyName}</p>
            {u.changelog && (
              <p className="text-xs text-[#4B4846] mt-0.5 truncate">{u.changelog}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => applyMutation.mutate(u.id)}
              disabled={applyMutation.isPending || dismissMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-medium text-[#1A9E68] hover:bg-[#E8F7F0] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              <CheckCircle2 size={13} />
              Appliquer
            </button>
            <button
              onClick={() => dismissMutation.mutate(u.id)}
              disabled={applyMutation.isPending || dismissMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-medium text-[#8A8680] hover:bg-[#F0EDE6] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              <XCircle size={13} />
              Ignorer
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}

// ── Master skills tab ─────────────────────────────────────────────────────────

function MasterSkillsTab() {
  const [editingSkill, setEditingSkill] = useState<MasterSkill | null>(null)
  const [notifiedCount, setNotifiedCount] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const masterQuery = useQuery({
    queryKey: ["admin-master-skills"],
    queryFn: () => adminApi.get<{ skills: MasterSkill[] }>("/admin/skills/master").then(r => r.skills),
    staleTime: 60_000,
  })

  function handleEditSuccess(notified: number) {
    setNotifiedCount(notified)
    setEditingSkill(null)
    queryClient.invalidateQueries({ queryKey: ["admin-master-skills"] })
  }

  return (
    <div className="flex flex-col gap-8">
      {notifiedCount != null && (
        <div className="bg-[#E8F7F0] border border-[#A7E3CC] rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-[#1A9E68] font-medium">
            {notifiedCount} tenant{notifiedCount !== 1 ? "s" : ""} notifié{notifiedCount !== 1 ? "s" : ""}.
          </span>
          <button onClick={() => setNotifiedCount(null)} className="text-[#1A9E68] hover:text-[#158a5a] text-sm">✕</button>
        </div>
      )}

      {/* Master skills list */}
      <section className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EDE6] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#0F0F0D]">Compétences maîtres</h2>
            {masterQuery.data && (
              <span className="text-xs bg-[#F5F5F3] text-[#6B7280] px-2 py-0.5 rounded-full font-medium">
                {masterQuery.data.length}
              </span>
            )}
          </div>
          {masterQuery.isLoading && <Loader2 size={14} className="animate-spin text-[#8A8680]" />}
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_140px_80px_80px_80px_80px] gap-3 px-5 py-2 border-b border-[#F0EDE6] text-xs font-medium text-[#8A8680]">
          <span>Nom</span>
          <span>Slug</span>
          <span>Tier</span>
          <span>GDPR</span>
          <span>AI Act</span>
          <span>Tenants utilisant</span>
        </div>

        {masterQuery.data?.length === 0 && (
          <p className="px-5 py-6 text-sm text-[#8A8680] text-center">
            Aucune compétence maître.
          </p>
        )}

        {masterQuery.data?.map(skill => (
          <MasterSkillRow key={skill.id} skill={skill} onEdit={setEditingSkill} />
        ))}
      </section>

      {/* Pending updates */}
      <PendingUpdatesPanel />

      {editingSkill && (
        <EditMasterSkillDialog
          skill={editingSkill}
          onClose={() => setEditingSkill(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "approval" | "master"

export function AdminSkills() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = React.useState<Tab>("approval")
  const [searchCompanyId, setSearchCompanyId] = React.useState("")
  const [searchSkillType, setSearchSkillType] = React.useState("")

  const tenantsQuery = useQuery({
    queryKey: ["admin-tenants-for-skills"],
    queryFn: () => adminApi.listTenants().then(r => r.tenants),
    staleTime: 60_000,
  })
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)

  const pendingQuery = useQuery({
    queryKey: ["admin-skills-pending"],
    queryFn:  () => adminApi.get<{ versions: PendingVersion[] }>("/admin/skills/pending").then(r => r.versions),
    staleTime: 30_000,
  })

  const versionsQuery = useQuery({
    queryKey: ["admin-skills-versions", searchCompanyId, searchSkillType],
    queryFn:  () => adminApi.get<{ versions: unknown[] }>(
      `/admin/skills/${searchSkillType}/versions?companyId=${searchCompanyId}`,
    ).then(r => r.versions),
    enabled: searchCompanyId.length > 10 && searchSkillType.length > 2,
    staleTime: 30_000,
  })

  const approveMutation = useMutation({
    mutationFn: (versionId: string) =>
      adminApi.post(`/admin/skills/_/versions/${versionId}/approve`),
    onMutate: (id) => setBusyId(id),
    onSettled: () => {
      setBusyId(null)
      queryClient.invalidateQueries({ queryKey: ["admin-skills-pending"] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (versionId: string) =>
      adminApi.post(`/admin/skills/_/versions/${versionId}/reject`),
    onMutate: (id) => setBusyId(id),
    onSettled: () => {
      setBusyId(null)
      queryClient.invalidateQueries({ queryKey: ["admin-skills-pending"] })
    },
  })

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-serif font-semibold text-[#0F0F0D]">Compétences</h1>
          <p className="mt-1 text-sm text-[#8A8680]">
            File d'approbation et gestion des compétences maîtres.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#E8E4DC]">
          {([ ["approval", "File d'approbation"], ["master", "Compétences maîtres"] ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                tab === key
                  ? "border-[#0F0F0D] text-[#0F0F0D]"
                  : "border-transparent text-[#8A8680] hover:text-[#0F0F0D]",
              )}
            >
              {label}
              {key === "approval" && pendingQuery.data && pendingQuery.data.length > 0 && (
                <span className="ml-2 text-xs bg-[#FFF8EC] text-[#C97C0A] px-1.5 py-0.5 rounded-full font-medium">
                  {pendingQuery.data.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: approval queue */}
        {tab === "approval" && (
          <div className="flex flex-col gap-8">
            {/* Pending approval queue */}
            <section className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0EDE6] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-[#C97C0A]" />
                  <h2 className="text-sm font-semibold text-[#0F0F0D]">En attente d'approbation</h2>
                  {pendingQuery.data && (
                    <span className="text-xs bg-[#FFF8EC] text-[#C97C0A] px-2 py-0.5 rounded-full font-medium">
                      {pendingQuery.data.length}
                    </span>
                  )}
                </div>
                {pendingQuery.isLoading && <Loader2 size={14} className="animate-spin text-[#8A8680]" />}
              </div>

              {pendingQuery.data?.length === 0 && (
                <p className="px-5 py-6 text-sm text-[#8A8680] text-center">
                  Aucune version en attente. ✓
                </p>
              )}

              {pendingQuery.data?.map(v => (
                <PendingRow
                  key={v.id}
                  v={v}
                  busy={busyId === v.id}
                  onApprove={(id) => approveMutation.mutate(id)}
                  onReject={(id) => rejectMutation.mutate(id)}
                />
              ))}
            </section>

            {/* Version browser */}
            <section className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0EDE6]">
                <h2 className="text-sm font-semibold text-[#0F0F0D] mb-3">Parcourir les versions</h2>
                <div className="flex gap-2">
                  <select
                    value={searchCompanyId}
                    onChange={e => setSearchCompanyId(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-[#E8E4DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1A9E68] bg-white"
                  >
                    <option value="">Sélectionner un tenant…</option>
                    {(tenantsQuery.data ?? []).map((t: import("@/api/admin").TenantSummary) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <input
                    value={searchSkillType}
                    onChange={e => setSearchSkillType(e.target.value)}
                    placeholder="Type de compétence (ex: qualification-cv)"
                    className="flex-1 px-3 py-2 text-sm border border-[#E8E4DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
                  />
                </div>
              </div>

              {versionsQuery.isLoading && (
                <div className="flex items-center gap-2 px-5 py-4 text-sm text-[#8A8680]">
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </div>
              )}

              {versionsQuery.data?.map((v: any) => (
                <button
                  key={(v as any).id}
                  onClick={() => navigate(`/instance/admin/skills/${searchSkillType}/versions/${(v as any).id}?companyId=${searchCompanyId}`)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 border-b border-[#F0EDE6] last:border-0 hover:bg-[#FAFAF8] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#0F0F0D]">v{(v as any).version}</span>
                      <StatusBadge status={(v as any).status} />
                      {(v as any).benchmarkScore != null && (
                        <span className="flex items-center gap-1 text-xs text-[#8A8680]">
                          <Star size={11} />
                          {parseFloat((v as any).benchmarkScore).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8A8680] mt-0.5">
                      {(v as any).triggerReason ?? "manual"} · {new Date((v as any).createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-[#8A8680]" />
                </button>
              ))}

              {versionsQuery.data?.length === 0 && (
                <p className="px-5 py-6 text-sm text-[#8A8680] text-center">
                  Aucune version trouvée pour ce skill.
                </p>
              )}
            </section>

            {/* New version CTA */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowNewDialog(true)}
                className="text-sm font-medium text-white bg-[#1A9E68] hover:bg-[#158a5a] px-4 py-2 rounded-xl transition-colors"
              >
                + Nouvelle version
              </button>
            </div>
          </div>
        )}

        {/* Tab: master skills */}
        {tab === "master" && <MasterSkillsTab />}
      </div>

      {showNewDialog && (
        <NewVersionDialog
          onClose={() => setShowNewDialog(false)}
          onCreated={(skillType, versionId, companyId) => {
            setShowNewDialog(false)
            navigate(`/instance/admin/skills/${skillType}/versions/${versionId}?companyId=${companyId}`)
          }}
        />
      )}
    </div>
  )
}
