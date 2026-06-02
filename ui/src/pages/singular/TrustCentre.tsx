import * as React from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2, SlidersHorizontal, X } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { TrustBar } from "@/components/singular"
import { Button } from "@/components/ui/button"
import { useCompany } from "../../context/CompanyContext"
import { trustApi, type TrustProposal, type TrustScore } from "@/api/trust"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AutonomyTier = "building" | "supervised" | "trusted" | "highlyTrusted"

function autonomyLabel(level: string): string {
  switch (level) {
    case "highlyTrusted": return "Highly autonomous"
    case "trusted":       return "Trusted"
    case "supervised":    return "Supervised"
    default:              return "Building"
  }
}

function autonomyColour(level: string) {
  switch (level) {
    case "highlyTrusted": return "text-[#1A9E68] font-semibold"
    case "trusted":       return "text-[#1A9E68]"
    case "supervised":    return "text-[#C97C0A]"
    default:              return "text-[#8A8680]"
  }
}

function evidenceLine(p: TrustProposal) {
  const { avgRating, taskCount } = p.evidence
  return `${avgRating?.toFixed(1).replace(".", ",") ?? "–"}/5 avg · ${taskCount ?? "–"} tasks`
}

function levelToHuman(level: string) {
  switch (level) {
    case "highlyTrusted": return "highly autonomous — summaries only"
    case "trusted":       return "trusted — spot-checked"
    case "supervised":    return "supervised — you approve each batch"
    default:              return "en construction"
  }
}

function agentInitial(name?: string) {
  return (name ?? "?").charAt(0).toUpperCase()
}

// ---------------------------------------------------------------------------
// ProposalCard
// ---------------------------------------------------------------------------

interface ProposalCardProps {
  proposal: TrustProposal
  onApprove: () => void
  onReject: () => void
  busy: boolean
}

function ProposalCard({ proposal, onApprove, onReject, busy }: ProposalCardProps) {
  const { t } = useTranslation("trust")
  const agentName = proposal.agentName ?? proposal.agentId
  return (
    <div className="bg-[#EFF3FA] border border-[#1A4E8C]/20 border-l-4 border-l-[#1A4E8C] rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#1A4E8C] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {agentInitial(agentName)}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#0F0F0D]">
            {agentName} — {proposal.skillType}
          </p>
        </div>
      </div>

      <div className="border-t border-[#1A4E8C]/15" />

      <div className="flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2">
          <span className="text-[#8A8680] font-medium">Current</span>
          <span className="text-[#0F0F0D]">{levelToHuman(proposal.currentLevel)}</span>

          <span className="text-[#8A8680] font-medium">Proposed</span>
          <span className="text-[#0F0F0D] font-medium">{levelToHuman(proposal.proposedLevel)}</span>

          <span className="text-[#8A8680] font-medium">Evidence</span>
          <span className="text-[#1A9E68] font-medium">{evidenceLine(proposal)}</span>

          <span className="text-[#8A8680] font-medium">Changes</span>
          <span className="text-[#0F0F0D]">Vous recevrez un résumé hebdomadaire des sélections.</span>

          <span className="text-[#8A8680] font-medium">What stays the same</span>
          <span className="text-[#0F0F0D]">Vous pouvez demander à voir n'importe quelle tâche à tout moment.</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          onClick={onApprove}
          disabled={busy}
          size="sm"
          className="bg-[#1A9E68] hover:bg-[#1A9E68]/90 text-white gap-1.5 text-sm"
        >
          <CheckCircle2 size={14} />
          {busy ? "…" : "Approve"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-sm border-[#1A4E8C]/30 text-[#1A4E8C] hover:bg-[#EFF3FA]"
          disabled={busy}
        >
          <SlidersHorizontal size={14} />
          Edit skill
        </Button>
        <Button
          onClick={onReject}
          variant="ghost"
          size="sm"
          disabled={busy}
          className="gap-1.5 text-sm text-[#8A8680] hover:text-[#B91C1C] hover:bg-[#FEF2F2]"
        >
          <X size={14} />
          Reject
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TrustTableRow
// ---------------------------------------------------------------------------

function TrustTableRow({ score }: { score: TrustScore }) {
  const label = autonomyLabel(score.autonomyLevel)
  const colour = autonomyColour(score.autonomyLevel)
  const agentName = score.agentName ?? score.agentId
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 py-3">
      {/* Agent + skill — full width on mobile, fixed width on desktop */}
      <div className="sm:w-44 sm:flex-shrink-0 min-w-0">
        <span className="text-sm font-medium text-[#0F0F0D]">{agentName}</span>
        <span className="text-sm text-[#8A8680]"> · {score.skillType}</span>
      </div>
      {/* Bar + level on the same row (even on mobile) */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <TrustBar
            score={score.score}
            label={`${Number(score.score).toFixed(1).replace(".", ",")} / 5`}
          />
        </div>
        <div className="w-28 flex-shrink-0 text-right">
          <span className={cn("text-sm", colour)}>
            {score.autonomyLevel === "highlyTrusted" && (
              <CheckCircle2 size={13} className="inline mr-1 mb-0.5" />
            )}
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TrustCentre() {
  const { t } = useTranslation("trust")
  const { selectedCompanyId } = useCompany()
  const queryClient = useQueryClient()
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set())
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ["trust", selectedCompanyId],
    queryFn: () => trustApi.getCompanyTrust(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  })

  const approveMutation = useMutation({
    mutationFn: (proposalId: string) =>
      trustApi.approveProposal(selectedCompanyId!, proposalId),
    onSuccess: (_, proposalId) => {
      setDismissedIds((prev) => new Set([...prev, proposalId]))
      setBusyId(null)
      queryClient.invalidateQueries({ queryKey: ["trust", selectedCompanyId] })
    },
    onError: () => setBusyId(null),
  })

  const rejectMutation = useMutation({
    mutationFn: (proposalId: string) =>
      trustApi.rejectProposal(selectedCompanyId!, proposalId),
    onSuccess: (_, proposalId) => {
      setDismissedIds((prev) => new Set([...prev, proposalId]))
      setBusyId(null)
      queryClient.invalidateQueries({ queryKey: ["trust", selectedCompanyId] })
    },
    onError: () => setBusyId(null),
  })

  const scores: TrustScore[] = data?.scores ?? []
  const proposals: TrustProposal[] = (data?.proposals ?? []).filter(
    (p) => p.status === "pending" && !dismissedIds.has(p.id)
  )
  const approvedCount = dismissedIds.size

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">Trust centre</h1>
          <p className="text-sm text-[#8A8680] mt-1">Manage how much autonomy your agents have.</p>
        </div>

        {/* Section 1 — Propositions */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">
              Autonomy proposals
            </h2>
            {proposals.length > 0 && (
              <span className="text-xs font-semibold bg-[#1A4E8C] text-white px-2 py-0.5 rounded-full">
                {proposals.length}
              </span>
            )}
          </div>

          {proposals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6 text-center">
              <CheckCircle2 size={24} className="mx-auto text-[#1A9E68] mb-2" />
              <p className="text-sm text-[#8A8680]">All caught up — no pending proposals.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  busy={busyId === proposal.id}
                  onApprove={() => {
                    setBusyId(proposal.id)
                    approveMutation.mutate(proposal.id)
                  }}
                  onReject={() => {
                    setBusyId(proposal.id)
                    rejectMutation.mutate(proposal.id)
                  }}
                />
              ))}
            </div>
          )}

          {approvedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-[#1A9E68] bg-[#ECFBF4] border border-[#1A9E68]/20 rounded-xl px-4 py-2.5">
              <CheckCircle2 size={14} />
              Autonomy level updated. The agent will handle this type of task independently.
            </div>
          )}
        </section>

        {/* Section 2 — Niveaux actifs */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">
            Active trust levels
          </h2>

          <div className="flex flex-wrap gap-4 text-xs text-[#8A8680]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#8A8680]" /> Building
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#C97C0A]" /> Supervised
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#1A9E68]" /> Trusted
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm px-5 divide-y divide-[#E8E4DC]">
            {scores.map((score, i) => (
              <TrustTableRow key={i} score={score} />
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
