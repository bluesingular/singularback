import * as React from "react"
import { ArrowLeft, AlertTriangle, Star, Loader2, FileText } from "lucide-react"
import { useNavigate, useParams } from "@/lib/router"
import { cn } from "@/lib/utils"
import { MicroReward, HandoffIndicator } from "@/components/singular"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { issuesApi } from "@/api/issues"
import { requestBiometric, isBiometricAvailable } from "@/hooks/useWebAuthn"
import { useStreamingTask } from "@/hooks/useStreamingTask"
import { useCompany } from "../../context/CompanyContext"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StarDisplay({ score }: { score: number }) {
  const full  = Math.floor(score)
  const half  = score % 1 >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span className="text-[#C97C0A] text-sm" title={`${score}/5`}>
      {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(empty)}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    pending_approval: { label: "Awaiting approval", classes: "bg-[#FFF8EC] text-[#C97C0A] border-[#C97C0A]/20" },
    in_progress:      { label: "In progress",       classes: "bg-[#EFF6FF] text-[#1A4E8C] border-[#1A4E8C]/20" },
    done:             { label: "Done",               classes: "bg-[#ECFBF4] text-[#1A9E68] border-[#1A9E68]/20" },
    failed:           { label: "Failed",             classes: "bg-[#FEF2F2] text-[#B91C1C] border-[#B91C1C]/20" },
    todo:             { label: "Todo",               classes: "bg-[#F5F5F3] text-[#8A8680] border-[#E8E4DC]" },
  }
  const cfg = map[status] ?? { label: status, classes: "bg-[#F5F5F3] text-[#8A8680] border-[#E8E4DC]" }
  return (
    <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium flex-shrink-0", cfg.classes)}>
      {cfg.label}
    </span>
  )
}

function SkeletonTask() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5 animate-pulse">
      <div className="h-4 bg-[#E8E4DC] rounded w-20" />
      <div className="bg-white rounded-2xl border border-[#E8E4DC] p-5 flex flex-col gap-3">
        <div className="h-5 bg-[#E8E4DC] rounded w-2/3" />
        <div className="h-3 bg-[#E8E4DC] rounded w-1/3" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-[#E8E4DC] rounded" />
        <div className="h-3 bg-[#E8E4DC] rounded w-4/5" />
        <div className="h-3 bg-[#E8E4DC] rounded w-3/5" />
      </div>
    </div>
  )
}

function ApprovalWidget({ onApprove }: { onApprove: (rating: number) => void }) {
  const [hovered,  setHovered]  = React.useState(0)
  const [selected, setSelected] = React.useState(0)

  return (
    <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-[#0F0F0D]">Review this output</p>
        <p className="text-xs text-[#8A8680] mt-0.5">Rate the quality of the agent's work</p>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
            onClick={() => setSelected(n)} className="p-0.5 transition-transform hover:scale-110">
            <Star size={24} className={cn("transition-colors",
              n <= (hovered || selected) ? "fill-[#C97C0A] text-[#C97C0A]" : "text-[#E8E4DC] fill-[#E8E4DC]"
            )} />
          </button>
        ))}
        {selected > 0 && <span className="ml-2 text-sm text-[#8A8680]">{selected}/5</span>}
      </div>
      <Button
        onClick={async () => {
          if (isBiometricAvailable()) {
            const ok = await requestBiometric()
            if (!ok) return
          }
          onApprove(selected || 5)
        }}
        className="bg-[#1A9E68] hover:bg-[#1A9E68]/90 text-white w-full sm:w-fit"
        disabled={selected === 0} size="sm">
        Approve
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TaskThread() {
  const navigate = useNavigate()
  const { id: issueId } = useParams<{ id?: string }>()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { selectedCompanyId } = useCompany()
  const [approved,       setApproved]       = React.useState(false)
  const [microRewardMsg, setMicroRewardMsg] = React.useState<string | null>(null)
  const { streamingText, isStreaming }      = useStreamingTask(issueId)

  const { data: issue, isLoading, isError } = useQuery({
    queryKey: ["issue", issueId],
    queryFn:  () => issuesApi.get(issueId!),
    enabled:  !!issueId,
    staleTime: 30_000,
  })

  async function handleApprove(rating: number) {
    if (issueId) {
      try {
        const result = await issuesApi.rate(issueId, rating)
        if (result.trust?.proposalCreated) {
          setMicroRewardMsg("Trust proposal created — review it in the Trust centre.")
        } else if (result.trust && result.trust.newStreak > 0 && result.trust.newStreak % 5 === 0) {
          setMicroRewardMsg(`${result.trust.newStreak} approvals in a row — the agent is learning your preferences.`)
        }
      } catch {
        // Graceful degradation
      }
    }
    setApproved(true)
  }

  if (isLoading) return <div className="min-h-screen bg-[#FAFAF8]"><SkeletonTask /></div>

  if (isError || !issue) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-3">
          <FileText size={32} className="text-[#E8E4DC]" />
          <p className="text-sm text-[#8A8680]">Task not found.</p>
          <button onClick={() => navigate(-1)} className="text-sm text-[#1A4E8C] hover:underline">Go back</button>
        </div>
      </div>
    )
  }

  const agentName    = "Agent"
  const agentInitial = agentName.charAt(0).toUpperCase()
  const output       = issue.description ?? ""
  const isPending    = ["pending_approval", "in_review"].includes(issue.status)

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">

        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors w-fit">
          <ArrowLeft size={14} /> Back
        </button>

        {/* Task header */}
        <section className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">{issue.title}</h1>
              <p className="text-sm text-[#8A8680] mt-0.5">
                {agentName}{issue.identifier ? ` · ${issue.identifier}` : ""}
              </p>
            </div>
            <StatusPill status={issue.status} />
          </div>
        </section>

        {/* Agent output */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1A9E68] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 mt-0.5">
            {agentInitial}
          </div>
          <div className="flex-1 bg-white border border-[#E8E4DC] rounded-2xl rounded-tl-sm p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#1A9E68] mb-1.5">{agentName}</p>
            {output ? (
              <p className="text-sm text-[#0F0F0D] leading-relaxed whitespace-pre-wrap">{output}</p>
            ) : (
              <p className="text-sm text-[#8A8680] italic">No output yet — the agent is still working.</p>
            )}
            {issue.completedAt && (
              <p className="text-xs text-[#8A8680] mt-2">
                {new Date(issue.completedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
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
                <p className="text-xs font-semibold text-[#1A9E68]">{agentName} · writing…</p>
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
                <div key={wp.id} className="bg-[#FAFAF8] border border-[#E8E4DC] rounded-xl p-3 flex items-center gap-3">
                  <FileText size={14} className="text-[#8A8680] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F0F0D] truncate">{wp.title ?? "Document"}</p>
                  </div>
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

        {/* Approval */}
        {isPending && !approved && !isStreaming && (
          <div className="flex items-start gap-3">
            <div className="hidden sm:block w-8 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <ApprovalWidget onApprove={handleApprove} />
            </div>
          </div>
        )}

        {approved && (
          <MicroReward message={microRewardMsg ?? "Thank you. The agent has recorded your feedback."} />
        )}

        {issue.status === "done" && issue.assigneeAgentId && (
          <HandoffIndicator from={agentName} to="Next agent" summary="Task completed and handed off." />
        )}
      </div>
    </div>
  )
}
