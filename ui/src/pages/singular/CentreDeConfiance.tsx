import * as React from "react"
import { CheckCircle2, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { TrustBar } from "@/components/singular"
import { Button } from "@/components/ui/button"

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface Proposal {
  id: string
  agentName: string
  agentInitial: string
  skill: string
  currentLevel: string
  proposedLevel: string
  evidence: string
  changeDescription: string
  remainsDescription: string
}

const proposals: Proposal[] = [
  {
    id: "prop-1",
    agentName: "Sophie",
    agentInitial: "S",
    skill: "Qualification de CV",
    currentLevel: "vous validez chaque lot",
    proposedLevel: "les lots de moins de 15 CV tournent automatiquement",
    evidence: "4,8/5 de moyenne · 47 lots · 6 semaines",
    changeDescription: "Vous recevrez un résumé hebdomadaire de toutes les sélections.",
    remainsDescription: "Vous pouvez demander à voir n'importe quel lot à tout moment.",
  },
]

interface TrustRow {
  agentName: string
  skill: string
  score: number
  autonomyLabel: string
  autonomyLevel: "building" | "supervised" | "trusted" | "highly"
}

const trustRows: TrustRow[] = [
  { agentName: "Sophie", skill: "Qualification de CV", score: 4.8, autonomyLabel: "Supervisée", autonomyLevel: "supervised" },
  { agentName: "Sophie", skill: "Rédaction d'offres", score: 5.0, autonomyLabel: "Autonome", autonomyLevel: "highly" },
  { agentName: "Marc", skill: "Emails clients", score: 2.8, autonomyLabel: "En construction", autonomyLevel: "building" },
  { agentName: "Clara", skill: "Posts LinkedIn", score: 3.5, autonomyLabel: "Supervisée", autonomyLevel: "supervised" },
  { agentName: "Julien", skill: "Suivi candidats", score: 2.5, autonomyLabel: "En construction", autonomyLevel: "building" },
  { agentName: "Iris", skill: "Veille marché", score: 4.0, autonomyLabel: "Supervisée", autonomyLevel: "supervised" },
]

// ---------------------------------------------------------------------------
// Autonomy label colour
// ---------------------------------------------------------------------------

function autonomyColour(level: TrustRow["autonomyLevel"]) {
  switch (level) {
    case "highly":
      return "text-[#1A9E68] font-semibold"
    case "trusted":
      return "text-[#1A9E68]"
    case "supervised":
      return "text-[#C97C0A]"
    case "building":
    default:
      return "text-[#8A8680]"
  }
}

// ---------------------------------------------------------------------------
// ProposalCard
// ---------------------------------------------------------------------------

interface ProposalCardProps {
  proposal: Proposal
  onAccept: () => void
  onEdit: () => void
  onReject: () => void
}

function ProposalCard({ proposal, onAccept, onEdit, onReject }: ProposalCardProps) {
  return (
    <div className="bg-[#EFF3FA] border border-[#1A4E8C]/20 border-l-4 border-l-[#1A4E8C] rounded-2xl p-5 flex flex-col gap-4">
      {/* Agent header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#1A4E8C] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {proposal.agentInitial}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#0F0F0D]">
            {proposal.agentName} — {proposal.skill}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#1A4E8C]/15" />

      {/* Details */}
      <div className="flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2">
          <span className="text-[#8A8680] font-medium">Niveau actuel</span>
          <span className="text-[#0F0F0D]">{proposal.currentLevel}</span>

          <span className="text-[#8A8680] font-medium">Proposé</span>
          <span className="text-[#0F0F0D] font-medium">{proposal.proposedLevel}</span>

          <span className="text-[#8A8680] font-medium">Preuve</span>
          <span className="text-[#1A9E68] font-medium">{proposal.evidence}</span>

          <span className="text-[#8A8680] font-medium">Ce qui change</span>
          <span className="text-[#0F0F0D]">{proposal.changeDescription}</span>

          <span className="text-[#8A8680] font-medium">Ce qui reste</span>
          <span className="text-[#0F0F0D]">{proposal.remainsDescription}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          onClick={onAccept}
          size="sm"
          className="bg-[#1A9E68] hover:bg-[#1A9E68]/90 text-white gap-1.5 text-sm"
        >
          <CheckCircle2 size={14} />
          Accepter cette proposition
        </Button>
        <Button
          onClick={onEdit}
          variant="outline"
          size="sm"
          className="gap-1.5 text-sm border-[#1A4E8C]/30 text-[#1A4E8C] hover:bg-[#EFF3FA]"
        >
          <SlidersHorizontal size={14} />
          Modifier le seuil
        </Button>
        <Button
          onClick={onReject}
          variant="ghost"
          size="sm"
          className="gap-1.5 text-sm text-[#8A8680] hover:text-[#B91C1C] hover:bg-[#FEF2F2]"
        >
          <X size={14} />
          Refuser
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TrustTableRow
// ---------------------------------------------------------------------------

function TrustTableRow({ row }: { row: TrustRow }) {
  return (
    <div className="flex items-center gap-4 py-3">
      {/* Agent + skill */}
      <div className="w-44 flex-shrink-0">
        <span className="text-sm font-medium text-[#0F0F0D]">{row.agentName}</span>
        <span className="text-sm text-[#8A8680]"> · {row.skill}</span>
      </div>

      {/* Bar */}
      <div className="flex-1">
        <TrustBar score={row.score} label={`${row.score.toFixed(1).replace(".", ",")} / 5`} />
      </div>

      {/* Label */}
      <div className="w-28 flex-shrink-0 text-right">
        <span className={cn("text-sm", autonomyColour(row.autonomyLevel))}>
          {row.autonomyLevel === "highly" && (
            <CheckCircle2 size={13} className="inline mr-1 mb-0.5" />
          )}
          {row.autonomyLabel}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CentreDeConfiance() {
  const [acceptedIds, setAcceptedIds] = React.useState<string[]>([])
  const [rejectedIds, setRejectedIds] = React.useState<string[]>([])

  const visibleProposals = proposals.filter(
    (p) => !acceptedIds.includes(p.id) && !rejectedIds.includes(p.id)
  )

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">Centre de confiance</h1>
          <p className="text-sm text-[#8A8680] mt-1">
            Gérez l'autonomie de vos agents et suivez leur progression.
          </p>
        </div>

        {/* Section 1 — Propositions */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">
              Propositions en attente
            </h2>
            {visibleProposals.length > 0 && (
              <span className="text-xs font-semibold bg-[#1A4E8C] text-white px-2 py-0.5 rounded-full">
                {visibleProposals.length}
              </span>
            )}
          </div>

          {visibleProposals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6 text-center">
              <CheckCircle2 size={24} className="mx-auto text-[#1A9E68] mb-2" />
              <p className="text-sm text-[#8A8680]">Aucune proposition en attente pour le moment.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visibleProposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onAccept={() => setAcceptedIds((prev) => [...prev, proposal.id])}
                  onEdit={() => {}}
                  onReject={() => setRejectedIds((prev) => [...prev, proposal.id])}
                />
              ))}
            </div>
          )}

          {acceptedIds.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-[#1A9E68] bg-[#ECFBF4] border border-[#1A9E68]/20 rounded-xl px-4 py-2.5">
              <CheckCircle2 size={14} />
              Proposition acceptée. Sophie va opérer avec plus d'autonomie dès maintenant.
            </div>
          )}
        </section>

        {/* Section 2 — Niveaux actifs */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">
            Niveaux de confiance actifs
          </h2>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-[#8A8680]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#8A8680]" /> En construction (0–3)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#C97C0A]" /> Supervisée (3–4)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#1A9E68]" /> De confiance (4+)
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm px-5 divide-y divide-[#E8E4DC]">
            {trustRows.map((row, i) => (
              <TrustTableRow key={i} row={row} />
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
