/**
 * ui/src/pages/singular/TaskThread.tsx
 *
 * Task detail + approval view.
 *
 * C8  — Judge score shown on every approval card (Definition of Done gate).
 *       Format per spec §C8:
 *         "Automatic evaluation: 8.2/10
 *          ├── Pertinence: 9/10 — Répond précisément à la demande
 *          ├── Exactitude: 8/10 — Affirmations vérifiables
 *          ..."
 *
 * Gap B — Inline output editor: operator edits before approving.
 *         Uses PATCH /companies/:id/tasks/:taskId/inline-edit which creates a
 *         golden_datasets row (weight 3.0, source 'inline_approval_edit').
 *         INVARIANT: no training signal when no change.
 */

import * as React from "react"
import {
  ArrowLeft, AlertTriangle, Star, Loader2, FileText, Sparkles,
} from "lucide-react"
import { useNavigate, useParams } from "@/lib/router"
import { cn } from "@/lib/utils"
import { MicroReward, HandoffIndicator } from "@/components/singular"
import { InlineOutputEditor } from "@/components/InlineOutputEditor"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { issuesApi } from "@/api/issues"
import { requestBiometric, isBiometricAvailable } from "@/hooks/useWebAuthn"
import { useStreamingTask } from "@/hooks/useStreamingTask"
import { useCompany } from "../../context/CompanyContext"

// ── Types ─────────────────────────────────────────────────────────────────────

interface DimensionRow {
  key:   string
  label: string  // from server
  score: number  // 0–10
  note:  string
}

interface JudgeContext {
  hasJudge:           boolean
  overallScore?:      number        // e.g. 8.2
  autoRecycled?:      boolean
  outputVersion?:     number
  dimensionBreakdown?: DimensionRow[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_approval: { label: "Pending approval", cls: "bg-[#FFF8EC] text-[#C97C0A] border-[#C97C0A]/20" },
    in_review:        { label: "In review",              cls: "bg-[#EFF3FA] text-[#1A4E8C] border-[#1A4E8C]/20" },
    in_progress:      { label: "In progress",                 cls: "bg-[#ECFBF4] text-[#1A9E68] border-[#1A9E68]/20" },
    done:             { label: "Done",                 cls: "bg-[#F5F5F3] text-[#8A8680] border-[#E8E4DC]"    },
    cancelled:        { label: "Cancelled",                  cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#B91C1C]/20" },
  }
  const cfg = map[status] ?? { label: status, cls: "bg-[#F5F5F3] text-[#8A8680] border-[#E8E4DC]" }
  return (
    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", cfg.cls)}>
      {cfg.label}
    </span>
  )
}

function SkeletonTask() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5 animate-pulse">
      <div className="h-5 w-20 bg-[#E8E4DC] rounded" />
      <div className="bg-white rounded-2xl border border-[#E8E4DC] p-5 h-24" />
      <div className="bg-white rounded-2xl border border-[#E8E4DC] p-4 h-32" />
    </div>
  )
}

// ── C8: Judge score breakdown ─────────────────────────────────────────────────
// Spec format:
//   Automatic evaluation: 8.2/10
//   ├── Pertinence: 9/10 — Répond précisément à la demande
//   └── Ton: 7/10 — Ton légèrement trop formel

function JudgeCard({ ctx }: { ctx: JudgeContext }) {
  if (!ctx.hasJudge || ctx.overallScore === undefined) return null

  const score = ctx.overallScore
  const scoreColor =
    score >= 8.0 ? "#1A9E68" :
    score >= 6.0 ? "#C97C0A" : "#B91C1C"

  const dims = ctx.dimensionBreakdown ?? []
  const lastIdx = dims.length - 1

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ backgroundColor: scoreColor + "08", borderColor: scoreColor + "33" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={13} style={{ color: scoreColor }} />
          <span className="text-xs font-semibold" style={{ color: scoreColor }}>
            Automatic evaluation
          </span>
          {ctx.autoRecycled && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "#1A4E8C15", color: "#1A4E8C" }}
            >
              auto-revised
            </span>
          )}
        </div>
        {/* Overall score per spec: "8.2/10" */}
        <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor }}>
          {score.toFixed(1).replace(".", ",")}/10
        </span>
      </div>

      {/* Dimension breakdown — tree format */}
      {dims.length > 0 && (
        <div className="flex flex-col gap-1 pl-1">
          {dims.map((d, i) => (
            <div key={d.key} className="flex items-start gap-1.5 text-xs text-[#4B4846]">
              <span className="font-mono text-[#8A8680] flex-shrink-0 select-none">
                {i === lastIdx ? "└──" : "├──"}
              </span>
              <span>
                <span className="font-semibold">{d.label}&nbsp;:&nbsp;</span>
                <span className="font-semibold tabular-nums" style={{ color: scoreColor }}>
                  {d.score}/10
                </span>
                {d.note && (
                  <span className="text-[#8A8680]"> — {d.note}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Approval section: C8 score + Gap B editor + star rating ──────────────────

function ApprovalSection({
  issueId,
  companyId,
  output,
  judgeCtx,
  onApprove,
}: {
  issueId:   string
  companyId: string
  output:    string
  judgeCtx:  JudgeContext | null
  onApprove: (rating: number) => void
}) {
  const [hovered,       setHovered]       = React.useState(0)
  const [selected,      setSelected]      = React.useState(0)
  const [editedOutput,  setEditedOutput]  = React.useState<string | null>(null)

  return (
    <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-[#0F0F0D]">Review this output</p>
        <p className="text-xs text-[#8A8680] mt-0.5">
          Rate the quality of the agent's work
        </p>
      </div>

      {/* C8: full judge breakdown */}
      {judgeCtx && <JudgeCard ctx={judgeCtx} />}

      {/* Gap B: inline editor — uses taskId directly */}
      {output && (
        <InlineOutputEditor
          taskId={issueId}
          companyId={companyId}
          originalOutput={editedOutput ?? output}
          onEditSaved={(edited) => setEditedOutput(edited)}
        />
      )}

      {/* Star rating */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setSelected(n)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              size={24}
              className={cn(
                "transition-colors",
                n <= (hovered || selected)
                  ? "fill-[#C97C0A] text-[#C97C0A]"
                  : "fill-[#E8E4DC] text-[#E8E4DC]",
              )}
            />
          </button>
        ))}
        {selected > 0 && (
          <span className="ml-2 text-sm text-[#8A8680]">{selected}/5</span>
        )}
      </div>

      <Button
        onClick={async () => {
          if (isBiometricAvailable()) {
            const ok = await requestBiometric()
            if (!ok) return
          }
          onApprove(selected || 5)
        }}
        disabled={selected === 0}
        className="bg-[#1A9E68] hover:bg-[#1A9E68]/90 text-white w-full sm:w-fit"
        size="sm"
      >
        Approve
      </Button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TaskThread() {
  const navigate = useNavigate()
  const { id: issueId } = useParams<{ id?: string }>()
  const { selectedCompanyId } = useCompany()

  const [approved,       setApproved]       = React.useState(false)
  const [microRewardMsg, setMicroRewardMsg] = React.useState<string | null>(null)
  const { streamingText, isStreaming }      = useStreamingTask(issueId)

  // Task data
  const { data: issue, isLoading, isError } = useQuery({
    queryKey:  ["issue", issueId],
    queryFn:   () => issuesApi.get(issueId!),
    enabled:   !!issueId,
    staleTime: 30_000,
  })

  const isPending = ["pending_approval", "in_review"].includes(issue?.status ?? "")

  // C8: fetch judge score only while task needs approval
  const { data: judgeCtx } = useQuery<JudgeContext>({
    queryKey: ["judge-context", selectedCompanyId, issueId],
    queryFn:  async () => {
      const res = await fetch(
        `/api/companies/${selectedCompanyId}/tasks/${issueId}/approval-context`,
        { credentials: "include" },
      )
      if (!res.ok) return { hasJudge: false }
      return res.json()
    },
    enabled:   !!selectedCompanyId && !!issueId && isPending,
    staleTime: 60_000,
  })

  async function handleApprove(rating: number) {
    if (issueId) {
      try {
        const result = await issuesApi.rate(issueId, rating)
        if (result.trust?.proposalCreated) {
          setMicroRewardMsg(
            "Proposition de confiance créée — consultez le Centre de confiance.",
          )
        } else if (
          result.trust &&
          result.trust.newStreak > 0 &&
          result.trust.newStreak % 5 === 0
        ) {
          setMicroRewardMsg(
            `${result.trust.newStreak} approvals in a row — the agent is learning your preferences.`,
          )
        }
      } catch {
        /* graceful degradation */
      }
    }
    setApproved(true)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <div className="min-h-screen bg-[#FAFAF8]"><SkeletonTask /></div>
  }

  if (isError || !issue) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-3">
          <FileText size={32} className="text-[#E8E4DC]" />
          <p className="text-sm text-[#8A8680]">Task not found.</p>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-[#1A4E8C] hover:underline"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  const agentName    = "Agent"
  const agentInitial = agentName.charAt(0).toUpperCase()
  const output       = issue.description ?? ""

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* Task header */}
        <section className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">
                {issue.title}
              </h1>
              <p className="text-sm text-[#8A8680] mt-0.5">
                {agentName}
                {issue.identifier ? ` · ${issue.identifier}` : ""}
              </p>
            </div>
            <StatusPill status={issue.status} />
          </div>
        </section>

        {/* Agent output bubble */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1A9E68] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 mt-0.5">
            {agentInitial}
          </div>
          <div className="flex-1 bg-white border border-[#E8E4DC] rounded-2xl rounded-tl-sm p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#1A9E68] mb-1.5">{agentName}</p>
            {output ? (
              <p className="text-sm text-[#0F0F0D] leading-relaxed whitespace-pre-wrap">
                {output}
              </p>
            ) : (
              <p className="text-sm text-[#8A8680] italic">
                No output yet — the agent is still working.
              </p>
            )}
            {issue.completedAt && (
              <p className="text-xs text-[#8A8680] mt-2">
                {new Date(issue.completedAt).toLocaleString("en-GB", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>
        </div>

        {/* Live streaming */}
        {isStreaming && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1A9E68] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 mt-0.5">
              {agentInitial}
            </div>
            <div className="flex-1 bg-white border border-[#1A9E68]/30 rounded-2xl rounded-tl-sm p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 size={12} className="animate-spin text-[#1A9E68]" />
                <p className="text-xs font-semibold text-[#1A9E68]">
                  {agentName} · writing...
                </p>
              </div>
              <p className="text-sm text-[#0F0F0D] leading-relaxed whitespace-pre-wrap font-mono">
                {streamingText}
                <span className="inline-block w-0.5 h-4 bg-[#1A9E68] animate-pulse ml-0.5 align-middle" />
              </p>
            </div>
          </div>
        )}

        {/* Work products */}
        {(issue.workProducts ?? []).length > 0 && (
          <div className="flex items-start gap-3">
            <div className="w-8 flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              {issue.workProducts!.map((wp) => (
                <div
                  key={wp.id}
                  className="bg-[#FAFAF8] border border-[#E8E4DC] rounded-xl p-3 flex items-center gap-3"
                >
                  <FileText size={14} className="text-[#8A8680] flex-shrink-0" />
                  <p className="flex-1 text-sm font-medium text-[#0F0F0D] truncate">
                    {wp.title ?? "Document"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No-output warning */}
        {isPending && !output && !isStreaming && (
          <div className="bg-[#FFF8EC] border border-[#C97C0A]/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle size={15} className="text-[#C97C0A] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#8A8680]">
              <span className="font-medium text-[#0F0F0D]">Heads up: </span>
              The agent completed the task but produced no output. Check the skill configuration.
            </p>
          </div>
        )}

        {/* C8 + Gap B: approval section */}
        {isPending && !approved && !isStreaming && (
          <div className="flex items-start gap-3">
            <div className="hidden sm:block w-8 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <ApprovalSection
                issueId={issueId!}
                companyId={selectedCompanyId!}
                output={output}
                judgeCtx={judgeCtx ?? null}
                onApprove={handleApprove}
              />
            </div>
          </div>
        )}

        {approved && (
          <MicroReward
            message={
              microRewardMsg ??
              "Thank you. The agent has recorded your feedback."
            }
          />
        )}

        {issue.status === "done" && issue.assigneeAgentId && (
          <HandoffIndicator
            from={agentName}
            to="Next agent"
            summary="Task completed and handed off."
          />
        )}

      </div>
    </div>
  )
}
