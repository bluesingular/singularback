import * as React from "react"
import { ArrowLeft, AlertTriangle, Star } from "lucide-react"
import { useNavigate } from "@/lib/router"
import { cn } from "@/lib/utils"
import { MicroReward, HandoffIndicator } from "@/components/singular"
import { Button } from "@/components/ui/button"

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface Candidate {
  name: string
  score: number
  recommendation: "Recommandé" | "Possible" | "Non retenu"
  strengths: string[]
  note?: string
}

const candidates: Candidate[] = [
  {
    name: "Thomas Lefebvre",
    score: 4.5,
    recommendation: "Recommandé",
    strengths: [
      "5 ans d'expérience en recrutement tech",
      "Maîtrise des outils ATS et LinkedIn Recruiter",
      "Excellent profil communication",
    ],
  },
  {
    name: "Amira Benali",
    score: 3.5,
    recommendation: "Possible",
    strengths: [
      "Solide expérience en cabinet de conseil",
      "Bon réseau sectoriel",
    ],
    note: "Hors fourchette salariale de 12 %",
  },
  {
    name: "Romain Girard",
    score: 4.0,
    recommendation: "Recommandé",
    strengths: [
      "Profil polyvalent sourcing & relation client",
      "Disponible immédiatement",
      "Références vérifiées positives",
    ],
  },
  {
    name: "Julie Marchand",
    score: 2.5,
    recommendation: "Non retenu",
    strengths: [
      "Parcours en transition professionnelle",
    ],
    note: "Moins de 2 ans d'expérience en recrutement",
  },
  {
    name: "Karim Ouali",
    score: 5.0,
    recommendation: "Recommandé",
    strengths: [
      "Expert en sourcing de profils tech rares",
      "Expérience internationale en cabinet",
      "Réseau LinkedIn de 4 500 contacts qualifiés",
    ],
  },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StarDisplay({ score }: { score: number }) {
  const full = Math.floor(score)
  const half = score % 1 >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span className="text-[#C97C0A] text-sm" title={`${score}/5`}>
      {"★".repeat(full)}
      {half ? "½" : ""}
      {"☆".repeat(empty)}
    </span>
  )
}

function RecommendationPill({ value }: { value: Candidate["recommendation"] }) {
  const config: Record<
    Candidate["recommendation"],
    { classes: string }
  > = {
    Recommandé: { classes: "bg-[#ECFBF4] text-[#1A9E68] border border-[#1A9E68]/20" },
    Possible: { classes: "bg-[#FFF8EC] text-[#C97C0A] border border-[#C97C0A]/20" },
    "Non retenu": { classes: "bg-[#F5F5F3] text-[#8A8680] border border-[#E8E4DC]" },
  }
  return (
    <span className={cn("text-xs px-2.5 py-0.5 rounded-full font-semibold", config[value].classes)}>
      {value}
    </span>
  )
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <div className="bg-[#FAFAF8] border border-[#E8E4DC] rounded-xl p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0F0F0D]">{candidate.name}</p>
          <StarDisplay score={candidate.score} />
        </div>
        <RecommendationPill value={candidate.recommendation} />
      </div>
      <ul className="flex flex-col gap-1">
        {candidate.strengths.map((s, i) => (
          <li key={i} className="text-xs text-[#8A8680] flex items-start gap-1.5">
            <span className="text-[#1A9E68] mt-0.5 flex-shrink-0">·</span>
            {s}
          </li>
        ))}
      </ul>
      {candidate.note && (
        <p className="text-xs text-[#C97C0A] italic">{candidate.note}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Approval widget
// ---------------------------------------------------------------------------

interface ApprovalWidgetProps {
  onApprove: (rating: number) => void
}

function ApprovalWidget({ onApprove }: ApprovalWidgetProps) {
  const [hovered, setHovered] = React.useState(0)
  const [selected, setSelected] = React.useState(0)

  return (
    <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-[#0F0F0D]">
          Approuver cette sélection
        </p>
        <p className="text-xs text-[#8A8680] mt-0.5">
          Notez la qualité du travail de Sophie pour l'aider à progresser.
        </p>
      </div>

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
                  : "text-[#E8E4DC] fill-[#E8E4DC]"
              )}
            />
          </button>
        ))}
        {selected > 0 && (
          <span className="ml-2 text-sm text-[#8A8680]">{selected}/5</span>
        )}
      </div>

      <Button
        onClick={() => onApprove(selected || 5)}
        className="bg-[#1A9E68] hover:bg-[#1A9E68]/90 text-white w-fit"
        disabled={selected === 0}
        size="sm"
      >
        Approuver
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FilDeTache() {
  const navigate = useNavigate()
  const [approved, setApproved] = React.useState(false)

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Retour
        </button>

        {/* Schema warning (conditional) */}
        <div className="bg-[#FFF8EC] border border-[#C97C0A]/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-[#C97C0A] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-medium text-[#0F0F0D]">Note : </span>
            <span className="text-[#8A8680]">
              La réponse de Sophie ne contenait pas le champ &laquo;&nbsp;concerns&nbsp;&raquo;
              requis. Elle l'a complété automatiquement.
            </span>
            <button className="ml-1.5 text-[#C97C0A] font-medium hover:underline">
              Voir la correction →
            </button>
          </div>
        </div>

        {/* Task header */}
        <section className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">
                Sélection de CV — Mission React Senior
              </h1>
              <p className="text-sm text-[#8A8680] mt-0.5">Sophie · Qualification de CV</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#FFF8EC] text-[#C97C0A] border border-[#C97C0A]/20 font-medium flex-shrink-0">
              En attente de validation
            </span>
          </div>
        </section>

        {/* Thread — Sophie's opening message */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1A9E68] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 mt-0.5">
            S
          </div>
          <div className="flex-1 bg-white border border-[#E8E4DC] rounded-2xl rounded-tl-sm p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#1A9E68] mb-1.5">Sophie</p>
            <p className="text-sm text-[#0F0F0D] leading-relaxed">
              Bonjour, j'ai analysé les 5 candidatures reçues pour la mission{" "}
              <strong>React Senior</strong> chez Buildtech. Voici ma sélection détaillée
              avec une recommandation pour chaque profil. Karim Ouali se distingue
              particulièrement — je vous explique pourquoi ci-dessous.
            </p>
            <p className="text-xs text-[#8A8680] mt-2">il y a 12 min</p>
          </div>
        </div>

        {/* CV results */}
        <div className="flex items-start gap-3">
          <div className="w-8 flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-3">
            {candidates.map((candidate, i) => (
              <CandidateCard key={i} candidate={candidate} />
            ))}
          </div>
        </div>

        {/* Approval widget or micro-reward */}
        {approved ? (
          <MicroReward message="Merci. Sophie a enregistré vos critères — elle s'en souviendra pour toutes vos prochaines missions." />
        ) : (
          <div className="flex items-start gap-3">
            <div className="w-8 flex-shrink-0" />
            <div className="flex-1">
              <ApprovalWidget onApprove={() => setApproved(true)} />
            </div>
          </div>
        )}

        {/* Handoff indicator */}
        <HandoffIndicator
          from="Sophie"
          to="Marc"
          summary="3 candidats qualifiés passés à Marc pour présentation client"
        />

      </div>
    </div>
  )
}
