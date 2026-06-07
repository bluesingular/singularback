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
  Play, AlertCircle, Gauge,
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

// ── Frontmatter structured panel ──────────────────────────────────────────────

const MODEL_TIER_OPTIONS = [
  { value: 0, label: "T0 — Micro" },
  { value: 1, label: "T1 — Standard" },
  { value: 2, label: "T2 — Avancé" },
  { value: 3, label: "T3 — Frontier" },
]

const AI_ACT_OPTIONS = ["minimal", "limited", "high"]

interface ZeroToleranceRule {
  action_type: string
  condition:   string
}

interface JudgeWeights {
  relevance:       number
  accuracy:        number
  tone:            number
  completeness:    number
  scope_adherence: number
}

function sumWeights(w: JudgeWeights): number {
  return w.relevance + w.accuracy + w.tone + w.completeness + w.scope_adherence
}

function FrontmatterPanel({
  frontmatter,
  onChange,
  disabled,
}: {
  frontmatter: string
  onChange: (newFm: string) => void
  disabled: boolean
}) {
  // Parse current frontmatter
  const parsed = React.useMemo(() => {
    try { return JSON.parse(frontmatter) } catch { return {} }
  }, [frontmatter])

  // Local form state (controlled from parsed)
  const [gdprRequired, setGdprRequired] = React.useState<boolean>(!!parsed.gdpr_required)
  const [modelTier, setModelTier] = React.useState<number>(parsed.model_tier ?? 1)
  const [aiActRisk, setAiActRisk] = React.useState<string>(parsed.ai_act?.risk_level ?? "minimal")
  const [outputSchema, setOutputSchema] = React.useState<string>(
    parsed.output_schema ? JSON.stringify(parsed.output_schema, null, 2) : "{}",
  )
  const [judgeWeights, setJudgeWeights] = React.useState<JudgeWeights>({
    relevance:       parsed.judge_weights?.relevance       ?? 0.30,
    accuracy:        parsed.judge_weights?.accuracy        ?? 0.25,
    tone:            parsed.judge_weights?.tone            ?? 0.15,
    completeness:    parsed.judge_weights?.completeness    ?? 0.20,
    scope_adherence: parsed.judge_weights?.scope_adherence ?? 0.10,
  })
  const [ztRules, setZtRules] = React.useState<ZeroToleranceRule[]>(
    parsed.zero_tolerance_actions ?? [],
  )

  // Rebuild frontmatter JSON whenever a field changes
  function buildAndEmit(overrides: Partial<{
    gdpr: boolean; tier: number; risk: string; schema: string; weights: JudgeWeights; zt: ZeroToleranceRule[]
  }> = {}) {
    const g   = overrides.gdpr    ?? gdprRequired
    const t   = overrides.tier    ?? modelTier
    const r   = overrides.risk    ?? aiActRisk
    const s   = overrides.schema  ?? outputSchema
    const w   = overrides.weights ?? judgeWeights
    const zt  = overrides.zt      ?? ztRules

    let schemaObj: unknown = {}
    try { schemaObj = JSON.parse(s) } catch { /* keep empty */ }

    const newFm = {
      ...parsed,
      gdpr_required: g,
      model_tier:    t,
      ai_act:        { ...(parsed.ai_act ?? {}), risk_level: r },
      output_schema: schemaObj,
      judge_weights: w,
      zero_tolerance_actions: zt,
    }
    onChange(JSON.stringify(newFm, null, 2))
  }

  const weightsSum = sumWeights(judgeWeights)
  const weightsBad = Math.abs(weightsSum - 1) > 0.001

  function setWeight(key: keyof JudgeWeights, val: number) {
    const next = { ...judgeWeights, [key]: val }
    setJudgeWeights(next)
    buildAndEmit({ weights: next })
  }

  function addZtRule() {
    const next = [...ztRules, { action_type: "", condition: "always" }]
    setZtRules(next)
    buildAndEmit({ zt: next })
  }

  function removeZtRule(i: number) {
    const next = ztRules.filter((_, idx) => idx !== i)
    setZtRules(next)
    buildAndEmit({ zt: next })
  }

  function updateZtRule(i: number, field: "action_type" | "condition", val: string) {
    const next = ztRules.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
    setZtRules(next)
    buildAndEmit({ zt: next })
  }

  const inputCls = "w-full text-sm border border-[#E8E4DC] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] disabled:bg-[#FAFAF8] disabled:text-[#8A8680]"
  const labelCls = "text-xs font-medium text-[#8A8680] mb-1 block"

  return (
    <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#F0EDE6]">
        <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Paramètres structurés</p>
      </div>

      <div className="px-5 py-4 flex flex-col gap-5">
        {/* GDPR + Model tier */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>RGPD requis</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gdprRequired}
                disabled={disabled}
                onChange={e => { setGdprRequired(e.target.checked); buildAndEmit({ gdpr: e.target.checked }) }}
                className="w-4 h-4 rounded accent-[#1A9E68]"
              />
              <span className="text-sm text-[#0F0F0D]">
                {gdprRequired ? "Oui — T1_FR uniquement" : "Non"}
              </span>
            </label>
          </div>
          <div>
            <label className={labelCls}>Tier de modèle</label>
            <select
              value={modelTier}
              disabled={disabled}
              onChange={e => { const v = Number(e.target.value); setModelTier(v); buildAndEmit({ tier: v }) }}
              className={inputCls}
            >
              {MODEL_TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* AI Act risk */}
        <div>
          <label className={labelCls}>Risque AI Act</label>
          <select
            value={aiActRisk}
            disabled={disabled}
            onChange={e => { setAiActRisk(e.target.value); buildAndEmit({ risk: e.target.value }) }}
            className={inputCls}
          >
            {AI_ACT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* Output schema */}
        <div>
          <label className={labelCls}>Schéma de sortie (JSON)</label>
          <textarea
            value={outputSchema}
            disabled={disabled}
            rows={5}
            onChange={e => { setOutputSchema(e.target.value); buildAndEmit({ schema: e.target.value }) }}
            className="w-full text-xs font-mono border border-[#E8E4DC] rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] resize-y disabled:bg-[#FAFAF8] disabled:text-[#8A8680]"
          />
        </div>

        {/* Judge weights */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls + " mb-0"}>Pondération juge</label>
            {weightsBad && (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle size={11} />
                Somme : {weightsSum.toFixed(2)} (doit être 1.0)
              </span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(judgeWeights) as (keyof JudgeWeights)[]).map(k => (
              <div key={k}>
                <label className="text-[10px] text-[#8A8680] mb-0.5 block capitalize">{k.replace("_", " ")}</label>
                <input
                  type="number"
                  min={0} max={1} step={0.05}
                  value={judgeWeights[k]}
                  disabled={disabled}
                  onChange={e => setWeight(k, parseFloat(e.target.value) || 0)}
                  className="w-full text-sm border border-[#E8E4DC] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] disabled:bg-[#FAFAF8]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Zero tolerance actions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls + " mb-0"}>Actions zéro tolérance</label>
            {!disabled && (
              <button
                onClick={addZtRule}
                className="flex items-center gap-1 text-xs text-[#1A9E68] hover:underline"
              >
                <Plus size={11} />
                Ajouter
              </button>
            )}
          </div>
          {ztRules.length === 0 && (
            <p className="text-xs text-[#8A8680]">Aucune règle — toutes les actions suivent la calibration de confiance normale.</p>
          )}
          {ztRules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                value={rule.action_type}
                disabled={disabled}
                onChange={e => updateZtRule(i, "action_type", e.target.value)}
                placeholder="action_type (ex: send_email)"
                className="flex-1 text-sm border border-[#E8E4DC] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] disabled:bg-[#FAFAF8]"
              />
              <input
                value={rule.condition}
                disabled={disabled}
                onChange={e => updateZtRule(i, "condition", e.target.value)}
                placeholder="condition (ex: always)"
                className="flex-1 text-sm border border-[#E8E4DC] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A9E68] disabled:bg-[#FAFAF8]"
              />
              {!disabled && (
                <button onClick={() => removeZtRule(i)} className="text-[#8A8680] hover:text-red-600 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Test runner ────────────────────────────────────────────────────────────────

interface TestRunResult {
  examplesRun:    number
  passed:         number
  avgJudgeScore:  number
  failedExamples: { input: unknown; expected: unknown; actual: unknown; reason: string }[]
}

function TestRunner({
  skillType,
  versionId,
  goldenCount,
}: {
  skillType: string
  versionId: string
  goldenCount: number
}) {
  const [result, setResult] = React.useState<TestRunResult | null>(null)
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function runTests() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await adminApi.post<TestRunResult>(
        `/admin/skills/${skillType}/versions/${versionId}/test`,
      )
      setResult(res)
    } catch {
      setError("L'endpoint de test n'est pas encore disponible.")
    } finally {
      setRunning(false)
    }
  }

  const canRun = goldenCount >= 1

  return (
    <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#F0EDE6] flex items-center justify-between">
        <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Test contre les exemples</p>
        <button
          onClick={runTests}
          disabled={!canRun || running}
          title={!canRun ? "Ajoutez au moins 1 exemple golden pour lancer les tests" : undefined}
          className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#1A4E8C] hover:bg-[#153d6f] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {running ? "Test en cours…" : "Tester contre les exemples"}
        </button>
      </div>

      {!canRun && (
        <p className="px-5 py-3 text-xs text-[#8A8680]">
          Ajoutez au moins 1 exemple golden pour activer les tests.
        </p>
      )}

      {error && (
        <p className="px-5 py-3 text-xs text-[#C97C0A]">{error}</p>
      )}

      {result && (
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-6 text-sm">
            <span>
              <strong>{result.passed}/{result.examplesRun}</strong>
              <span className="text-[#8A8680] ml-1">exemples passés</span>
            </span>
            <span>
              <strong>{result.avgJudgeScore.toFixed(1)}</strong>
              <span className="text-[#8A8680] ml-1">score juge moyen</span>
            </span>
            <span className={result.passed === result.examplesRun ? "text-[#1A9E68]" : "text-red-600"}>
              {result.passed === result.examplesRun ? "Tous passés" : `${result.examplesRun - result.passed} échoué(s)`}
            </span>
          </div>

          {result.failedExamples.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wider mb-2">
                Exemples échoués
              </p>
              {result.failedExamples.map((ex, i) => (
                <div key={i} className="text-xs bg-[#FEF2F2] border border-red-100 rounded-lg p-3 mb-2">
                  <p className="text-red-600 font-medium mb-1">{ex.reason}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <pre className="bg-white rounded p-1.5 overflow-x-auto max-h-16">
                      {JSON.stringify(ex.expected, null, 2)}
                    </pre>
                    <pre className="bg-white rounded p-1.5 overflow-x-auto max-h-16">
                      {JSON.stringify(ex.actual, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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

// ── Quality report panel ──────────────────────────────────────────────────────

interface DimensionResult {
  name:        string
  score:       number
  maxScore:    number
  suggestions: string[]
}

interface SkillQualityReport {
  slug:           string
  overallScore:   number
  grade:          "A" | "B" | "C" | "D" | "F"
  dimensions:     DimensionResult[]
  topSuggestions: string[]
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-[#1A9E68]",
  B: "text-[#1A4E8C]",
  C: "text-[#C97C0A]",
  D: "text-[#C97C0A]",
  F: "text-red-600",
}

function QualityPanel({ promptBody, frontmatter, skillType }: {
  promptBody:  string
  frontmatter: string
  skillType:   string
}) {
  const [report, setReport] = React.useState<SkillQualityReport | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function runEval() {
    setLoading(true)
    setError(null)
    try {
      // Reconstruct minimal SKILL.md from prompt body + frontmatter JSON
      let fmYaml = ""
      try {
        const fmObj = JSON.parse(frontmatter)
        // Convert key JSON frontmatter fields to YAML-ish string for the evaluator
        const lines: string[] = []
        if (fmObj.gdpr_required !== undefined) lines.push(`gdpr_required: ${fmObj.gdpr_required}`)
        if (fmObj.model_tier    !== undefined) lines.push(`tier: ${fmObj.model_tier}`)
        if (fmObj.ai_act?.risk_level)          lines.push(`ai_act:\n  risk_level: ${fmObj.ai_act.risk_level}`)
        if (fmObj.output_schema && Object.keys(fmObj.output_schema).length > 0) {
          lines.push("output_schema:\n  type: object")
        }
        if (Array.isArray(fmObj.zero_tolerance_actions) && fmObj.zero_tolerance_actions.length > 0) {
          lines.push("zero_tolerance_actions:\n  - action_type: declared")
        }
        fmYaml = lines.join("\n")
      } catch { /* ignore */ }

      const fullMarkdown = `---\nname: ${skillType}\n${fmYaml}\n---\n\n${promptBody}`

      const res = await adminApi.post<{ data: SkillQualityReport }>("/admin/skills/eval", {
        markdown: fullMarkdown,
        slug: skillType,
      })
      setReport(res.data)
    } catch {
      setError("L'évaluation a échoué — vérifier le contenu du prompt.")
    } finally {
      setLoading(false)
    }
  }

  const barWidth = (score: number, max: number) => `${Math.round((score / max) * 100)}%`

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#F0EDE6] flex items-center justify-between">
          <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Qualité du skill</p>
          <button
            onClick={runEval}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#1A4E8C] hover:bg-[#153d6f] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Gauge size={12} />}
            {loading ? "Évaluation…" : "Évaluer"}
          </button>
        </div>

        {error && (
          <p className="px-5 py-3 text-xs text-red-600">{error}</p>
        )}

        {!report && !loading && !error && (
          <p className="px-5 py-6 text-sm text-[#8A8680] text-center">
            Cliquer sur Évaluer pour analyser la qualité du prompt.
          </p>
        )}

        {report && (
          <div className="px-5 py-4 flex flex-col gap-5">
            {/* Overall score */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-[#F5F5F3]">
                <span className={`text-2xl font-bold ${GRADE_COLORS[report.grade] ?? "text-[#0F0F0D]"}`}>
                  {report.grade}
                </span>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[#0F0F0D]">{report.overallScore}<span className="text-base text-[#8A8680]">/100</span></p>
                <p className="text-xs text-[#8A8680]">Score global</p>
              </div>
            </div>

            {/* Top suggestions */}
            {report.topSuggestions.length > 0 && (
              <div className="bg-[#FFF8EC] border border-[#F0EDE6] rounded-xl px-4 py-3 flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-[#C97C0A] uppercase tracking-wider mb-1">Priorités d'amélioration</p>
                {report.topSuggestions.map((s, i) => (
                  <p key={i} className="text-xs text-[#0F0F0D] flex items-start gap-2">
                    <span className="text-[#C97C0A] font-bold mt-0.5">{i + 1}.</span>
                    {s}
                  </p>
                ))}
              </div>
            )}

            {/* Dimension breakdown */}
            <div className="flex flex-col gap-3">
              {report.dimensions.map(dim => (
                <div key={dim.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#0F0F0D]">{dim.name}</span>
                    <span className="text-xs text-[#8A8680]">{dim.score}/{dim.maxScore}</span>
                  </div>
                  <div className="h-1.5 bg-[#F0EDE6] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        dim.score / dim.maxScore >= 0.8 ? "bg-[#1A9E68]" :
                        dim.score / dim.maxScore >= 0.5 ? "bg-[#C97C0A]" : "bg-red-400"
                      }`}
                      style={{ width: barWidth(dim.score, dim.maxScore) }}
                    />
                  </div>
                  {dim.suggestions.length > 0 && (
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {dim.suggestions.map((s, i) => (
                        <li key={i} className="text-[11px] text-[#8A8680]">↳ {s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type Tab = "editor" | "diff" | "golden" | "quality"

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

  const effectiveCompanyId = companyId || version?.companyId || ""
  const goldenCountQuery = useQuery({
    queryKey: ["admin-golden", skillType, effectiveCompanyId],
    queryFn: () => adminApi.get<{ items: unknown[] }>(
      `/admin/skills/${skillType}/golden-datasets?companyId=${effectiveCompanyId}`,
    ).then(r => r.items.length).catch(() => 0),
    enabled: !!skillType && !!effectiveCompanyId,
    staleTime: 30_000,
  })

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
    { id: "editor",  label: "Éditeur",       icon: FileText },
    { id: "diff",    label: "Diff parent",   icon: GitCompare },
    { id: "golden",  label: "Golden dataset", icon: Database },
    { id: "quality", label: "Qualité",        icon: Gauge },
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

            <FrontmatterPanel
              frontmatter={frontmatter}
              onChange={setFrontmatter}
              disabled={!canEdit}
            />

            <div className="bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0EDE6]">
                <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Frontmatter brut (JSON)</p>
              </div>
              <textarea
                value={frontmatter}
                onChange={e => setFrontmatter(e.target.value)}
                disabled={!canEdit}
                rows={6}
                className="w-full text-sm font-mono px-5 py-4 focus:outline-none resize-y disabled:bg-[#FAFAF8] disabled:text-[#8A8680]"
              />
              {fmError && <p className="px-5 pb-3 text-xs text-red-600">{fmError}</p>}
            </div>

            <TestRunner
              skillType={version.skillType}
              versionId={versionId!}
              goldenCount={goldenCountQuery.data ?? 0}
            />
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

        {/* Quality tab */}
        {tab === "quality" && (
          <QualityPanel
            promptBody={promptBody}
            frontmatter={frontmatter}
            skillType={version.skillType}
          />
        )}
      </div>
    </div>
  )
}
