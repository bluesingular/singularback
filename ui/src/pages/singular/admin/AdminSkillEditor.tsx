/**
 * Gap D — Admin skill editor.
 *
 * Tabs: Editor (prompt body + frontmatter form) | Diff (vs parent) | Golden datasets
 * Actions: Publish (draft→review→staging→active) | Approve | Reject | Rollback
 */

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeft, CheckCircle2, XCircle, RotateCcw, ChevronRight,
  Plus, Trash2, Loader2, GitBranch, Star, FileText, Database, GitCompare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { adminApi } from "../../../api/admin.js"
import { useNavigate } from "@/lib/router"

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

const PUBLISH_LABEL: Record<string, string> = {
  draft:   "Soumettre en review",
  review:  "Passer en staging",
  staging: "Activer",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_COLORS[status] ?? "bg-[#F5F5F3] text-[#6B7280]")}>
      {status.replace("_", " ")}
    </span>
  )
}

// ── Diff view ─────────────────────────────────────────────────────────────────

function DiffView({ current, parent }: { current: string; parent: string | null }) {
  if (!parent) {
    return (
      <p className="px-5 py-6 text-sm text-[#8A8680] text-center">
        Pas de version parente — ceci est la première version.
      </p>
    )
  }

  const currentLines = current.split("\n")
  const parentLines  = parent.split("\n")

  // Simple line-by-line diff
  const maxLen = Math.max(currentLines.length, parentLines.length)
  const rows: { type: "same" | "added" | "removed"; line: string }[] = []

  for (let i = 0; i < maxLen; i++) {
    const c = currentLines[i]
    const p = parentLines[i]
    if (c === p) {
      rows.push({ type: "same", line: c ?? "" })
    } else {
      if (p !== undefined) rows.push({ type: "removed", line: p })
      if (c !== undefined) rows.push({ type: "added",   line: c })
    }
  }

  return (
    <div className="overflow-x-auto">
      <pre className="text-xs font-mono leading-5 p-4">
        {rows.map((r, i) => (
          <div
            key={i}
            className={cn(
              "px-2 whitespace-pre-wrap",
              r.type === "added"   && "bg-[#E8F7F0] text-[#1A9E68]",
              r.type === "removed" && "bg-[#FEF2F2] text-red-600 line-through opacity-70",
            )}
          >
            {r.type === "added" ? "+ " : r.type === "removed" ? "- " : "  "}{r.line}
          </div>
        ))}
      </pre>
    </div>
  )
}

// ── Golden dataset tab ────────────────────────────────────────────────────────

interface GoldenItem {
  id: string
  input: Record<string, unknown>
  expectedOutput: Record<string, unknown>
  qualityScore: number | null
  notes: string | null
}

function GoldenDatasets({ skillType, companyId }: { skillType: string; companyId: string }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = React.useState(false)
  const [input, setInput] = React.useState("{}")
  const [output, setOutput] = React.useState("{}")
  const [score, setScore] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [jsonError, setJsonError] = React.useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ["admin-golden", skillType, companyId],
    queryFn: () => adminApi.get<{ items: GoldenItem[] }>(
      `/admin/skills/${skillType}/golden-datasets?companyId=${companyId}`,
    ).then(r => r.items),
  })

  const addMutation = useMutation({
    mutationFn: (body: object) =>
      adminApi.post(`/admin/skills/${skillType}/golden-datasets?companyId=${companyId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-golden", skillType, companyId] })
      setShowForm(false)
      setInput("{}")
      setOutput("{}")
      setScore("")
      setNotes("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) =>
      adminApi.delete(`/admin/skills/${skillType}/golden-datasets/${itemId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-golden", skillType, companyId] }),
  })

  function handleAdd() {
    setJsonError(null)
    try {
      const parsed = { input: JSON.parse(input), expectedOutput: JSON.parse(output) } as Record<string, unknown>
      if (score) parsed.qualityScore = parseInt(score, 10)
      if (notes) parsed.notes = notes
      addMutation.mutate(parsed)
    } catch {
      setJsonError("JSON invalide dans input ou output")
    }
  }

  return (
    <div>
      <div className="px-5 py-3 border-b border-[#F0EDE6] flex items-center justify-between">
        <span className="text-sm font-medium text-[#0F0F0D]">
          {listQuery.data?.length ?? "…"} exemple(s)
        </span>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#1A9E68] hover:bg-[#158a5a] px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={12} />
          Ajouter
        </button>
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b border-[#F0EDE6] bg-[#FAFAF8] flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#8A8680] mb-1 block">Input (JSON)</label>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                rows={5}
                className="w-full text-xs font-mono border border-[#E8E4DC] rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] resize-y"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#8A8680] mb-1 block">Expected output (JSON)</label>
              <textarea
                value={output}
                onChange={e => setOutput(e.target.value)}
                rows={5}
                className="w-full text-xs font-mono border border-[#E8E4DC] rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] resize-y"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-24">
              <label className="text-xs font-medium text-[#8A8680] mb-1 block">Score (1–5)</label>
              <input
                value={score}
                onChange={e => setScore(e.target.value)}
                type="number" min={1} max={5}
                className="w-full text-sm border border-[#E8E4DC] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-[#8A8680] mb-1 block">Notes</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full text-sm border border-[#E8E4DC] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
              />
            </div>
          </div>
          {jsonError && <p className="text-xs text-red-600">{jsonError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="text-xs font-medium text-white bg-[#1A9E68] hover:bg-[#158a5a] px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              {addMutation.isPending ? "Ajout…" : "Ajouter l'exemple"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs font-medium text-[#8A8680] hover:text-[#0F0F0D] px-3 py-1.5 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {listQuery.data?.map(item => (
        <div key={item.id} className="flex items-start gap-4 px-5 py-3 border-b border-[#F0EDE6] last:border-0 hover:bg-[#FAFAF8]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {item.qualityScore != null && (
                <span className="flex items-center gap-1 text-xs text-[#8A8680]">
                  <Star size={11} />
                  {item.qualityScore}/5
                </span>
              )}
              {item.notes && (
                <span className="text-xs text-[#8A8680] truncate">{item.notes}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <pre className="text-xs font-mono bg-[#F5F5F3] rounded p-2 overflow-x-auto max-h-20">
                {JSON.stringify(item.input, null, 2)}
              </pre>
              <pre className="text-xs font-mono bg-[#F5F5F3] rounded p-2 overflow-x-auto max-h-20">
                {JSON.stringify(item.expectedOutput, null, 2)}
              </pre>
            </div>
          </div>
          <button
            onClick={() => deleteMutation.mutate(item.id)}
            disabled={deleteMutation.isPending}
            className="text-[#8A8680] hover:text-red-600 transition-colors flex-shrink-0 mt-1"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {listQuery.data?.length === 0 && (
        <p className="px-5 py-6 text-sm text-[#8A8680] text-center">
          Aucun exemple golden pour ce skill.
        </p>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "editor" | "diff" | "golden"

export function AdminSkillEditor() {
  const { skillType, versionId } = useParams<{ skillType: string; versionId: string }>()
  const [searchParams] = useSearchParams()
  const companyId = searchParams.get("companyId") ?? ""
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [tab, setTab] = React.useState<Tab>("editor")
  const [promptBody, setPromptBody] = React.useState("")
  const [frontmatter, setFrontmatter] = React.useState("{}")
  const [fmError, setFmError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const versionQuery = useQuery({
    queryKey: ["admin-skill-version", versionId],
    queryFn: () => adminApi.get<{ version: any; parent: any | null }>(
      `/admin/skills/${skillType}/versions/${versionId}`,
    ),
    enabled: !!versionId,
  })

  const version = versionQuery.data?.version
  const parent  = versionQuery.data?.parent

  // Seed editor when data loads
  React.useEffect(() => {
    if (version) {
      setPromptBody(version.promptBody ?? "")
      setFrontmatter(version.frontmatter ? JSON.stringify(version.frontmatter, null, 2) : "{}")
    }
  }, [version?.id])

  const saveMutation = useMutation({
    mutationFn: (body: object) =>
      adminApi.patch(`/admin/skills/${skillType}/versions/${versionId}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-skill-version", versionId] }),
  })

  const publishMutation = useMutation({
    mutationFn: () => adminApi.post(`/admin/skills/${skillType}/versions/${versionId}/publish`),
    onMutate: () => setBusy(true),
    onSettled: () => {
      setBusy(false)
      queryClient.invalidateQueries({ queryKey: ["admin-skill-version", versionId] })
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => adminApi.post(`/admin/skills/${skillType}/versions/${versionId}/approve`),
    onMutate: () => setBusy(true),
    onSettled: () => {
      setBusy(false)
      queryClient.invalidateQueries({ queryKey: ["admin-skill-version", versionId] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => adminApi.post(`/admin/skills/${skillType}/versions/${versionId}/reject`),
    onMutate: () => setBusy(true),
    onSettled: () => {
      setBusy(false)
      queryClient.invalidateQueries({ queryKey: ["admin-skill-version", versionId] })
    },
  })

  const rollbackMutation = useMutation({
    mutationFn: () => adminApi.post(`/admin/skills/${skillType}/versions/${versionId}/rollback`),
    onMutate: () => setBusy(true),
    onSettled: () => {
      setBusy(false)
      queryClient.invalidateQueries({ queryKey: ["admin-skill-version", versionId] })
    },
  })

  function handleSave() {
    setFmError(null)
    try {
      const fm = JSON.parse(frontmatter)
      saveMutation.mutate({ promptBody, frontmatter: fm })
    } catch {
      setFmError("Frontmatter JSON invalide")
    }
  }

  const canEdit    = version?.status === "draft" || version?.status === "review"
  const canPublish = version?.status in { draft: 1, review: 1, staging: 1 }
  const canApprove = version?.status === "pending_approval"
  const canReject  = version?.status !== "active" && version?.status !== "deprecated"
  const canRollback = version?.status === "deprecated"

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "editor", label: "Éditeur",       icon: FileText },
    { id: "diff",   label: "Diff parent",   icon: GitCompare },
    { id: "golden", label: "Golden dataset", icon: Database },
  ]

  if (versionQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-[#8A8680]">
        <Loader2 size={16} className="animate-spin" /> Chargement…
      </div>
    )
  }

  if (!version) {
    return (
      <div className="p-8 text-sm text-red-600">Version introuvable.</div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div>
          <button
            onClick={() => navigate(`/instance/admin/skills`)}
            className="flex items-center gap-1.5 text-xs text-[#8A8680] hover:text-[#0F0F0D] mb-3 transition-colors"
          >
            <ArrowLeft size={13} />
            Retour aux compétences
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GitBranch size={15} className="text-[#8A8680]" />
                <h1 className="text-xl font-serif font-semibold text-[#0F0F0D]">
                  {version.skillType} <span className="text-[#8A8680] text-base">v{version.version}</span>
                </h1>
                <StatusBadge status={version.status} />
              </div>
              {version.benchmarkScore != null && (
                <span className="flex items-center gap-1 text-xs text-[#8A8680]">
                  <Star size={11} />
                  Benchmark : {parseFloat(version.benchmarkScore).toFixed(2)}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {canEdit && (
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="text-xs font-medium text-[#1A4E8C] hover:bg-[#EEF4FF] px-3 py-1.5 rounded-lg border border-[#1A4E8C] transition-colors disabled:opacity-40"
                >
                  {saveMutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
                </button>
              )}
              {canPublish && PUBLISH_LABEL[version.status] && (
                <button
                  onClick={() => publishMutation.mutate()}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#1A9E68] hover:bg-[#158a5a] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  <ChevronRight size={13} />
                  {PUBLISH_LABEL[version.status]}
                </button>
              )}
              {canApprove && (
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1A9E68] hover:bg-[#E8F7F0] px-3 py-1.5 rounded-lg border border-[#1A9E68] transition-colors disabled:opacity-40"
                >
                  <CheckCircle2 size={13} />
                  Approuver
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors disabled:opacity-40"
                >
                  <XCircle size={13} />
                  Rejeter
                </button>
              )}
              {canRollback && (
                <button
                  onClick={() => rollbackMutation.mutate()}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#C97C0A] hover:bg-[#FFF8EC] px-3 py-1.5 rounded-lg border border-[#C97C0A] transition-colors disabled:opacity-40"
                >
                  <RotateCcw size={13} />
                  Rollback
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E8E4DC] gap-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 pb-2.5 text-sm font-medium border-b-2 transition-colors",
                tab === t.id
                  ? "border-[#0F0F0D] text-[#0F0F0D]"
                  : "border-transparent text-[#8A8680] hover:text-[#0F0F0D]",
              )}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Editor tab */}
        {tab === "editor" && (
          <div className="flex flex-col gap-4">
            {!canEdit && (
              <div className="text-xs text-[#8A8680] bg-[#FFF8EC] border border-[#F0EDE6] rounded-xl px-4 py-2">
                Cette version est en lecture seule (statut : {version.status}).
              </div>
            )}

            <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0EDE6]">
                <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Prompt</p>
              </div>
              <textarea
                value={promptBody}
                onChange={e => setPromptBody(e.target.value)}
                disabled={!canEdit}
                rows={20}
                className="w-full text-sm font-mono px-5 py-4 focus:outline-none resize-y disabled:bg-[#FAFAF8] disabled:text-[#8A8680]"
                placeholder="Contenu du prompt…"
              />
            </div>

            <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0EDE6]">
                <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Frontmatter (JSON)</p>
              </div>
              <textarea
                value={frontmatter}
                onChange={e => setFrontmatter(e.target.value)}
                disabled={!canEdit}
                rows={8}
                className="w-full text-sm font-mono px-5 py-4 focus:outline-none resize-y disabled:bg-[#FAFAF8] disabled:text-[#8A8680]"
              />
              {fmError && <p className="px-5 pb-3 text-xs text-red-600">{fmError}</p>}
            </div>
          </div>
        )}

        {/* Diff tab */}
        {tab === "diff" && (
          <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#F0EDE6] flex items-center gap-2">
              <GitCompare size={14} className="text-[#8A8680]" />
              <span className="text-sm font-medium text-[#0F0F0D]">
                v{version.version} vs {parent ? `v${parent.version}` : "aucun parent"}
              </span>
            </div>
            <DiffView current={version.promptBody ?? ""} parent={parent?.promptBody ?? null} />
          </div>
        )}

        {/* Golden dataset tab */}
        {tab === "golden" && (
          <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
            <GoldenDatasets
              skillType={version.skillType}
              companyId={companyId || version.companyId}
            />
          </div>
        )}
      </div>
    </div>
  )
}
