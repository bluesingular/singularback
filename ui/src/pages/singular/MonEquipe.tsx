import * as React from "react"
import { ArrowRight } from "lucide-react"
import { useNavigate } from "@/lib/router"
import { cn } from "@/lib/utils"
import { TrustDot, AgentStatusBadge, HandoffIndicator } from "@/components/singular"

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const agents = [
  {
    slug: "sophie",
    name: "Sophie",
    role: "Chargée de sourcing",
    status: "actif" as const,
    trust: "trusted" as const,
    tasksDone: 23,
    handoffsOut: 3,
    handoffTarget: "Marc",
    skills: ["Qualification CV", "Sourcing", "Relance"],
  },
  {
    slug: "marc",
    name: "Marc",
    role: "Responsable relation client",
    status: "actif" as const,
    trust: "building" as const,
    tasksDone: 8,
    handoffsOut: 0,
    handoffTarget: undefined,
    skills: ["Email client", "Rapport hebdo"],
  },
  {
    slug: "clara",
    name: "Clara",
    role: "Chargée de contenu",
    status: "pause" as const,
    trust: "building" as const,
    tasksDone: 5,
    handoffsOut: 0,
    handoffTarget: undefined,
    skills: ["Rédaction offres", "Posts LinkedIn"],
  },
  {
    slug: "julien",
    name: "Julien",
    role: "Assistant administratif",
    status: "actif" as const,
    trust: "building" as const,
    tasksDone: 12,
    handoffsOut: 0,
    handoffTarget: undefined,
    skills: ["Suivi candidats"],
  },
  {
    slug: "iris",
    name: "Iris",
    role: "Analyste marché",
    status: "actif" as const,
    trust: "building" as const,
    tasksDone: 4,
    handoffsOut: 0,
    handoffTarget: undefined,
    skills: ["Veille marché"],
  },
]

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------

interface AgentCardProps {
  agent: (typeof agents)[number]
  onClick: () => void
}

function AgentCard({ agent, onClick }: AgentCardProps) {
  const avatarBg =
    agent.status === "actif" ? "bg-[#1A9E68]" : "bg-[#8A8680]"

  return (
    <button
      onClick={onClick}
      className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md hover:border-[#1A9E68]/30 transition-all text-left relative group"
    >
      {/* Trust dot — top right */}
      <div className="absolute top-4 right-4">
        <TrustDot level={agent.trust} />
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-semibold flex-shrink-0",
            avatarBg
          )}
        >
          {agent.name.charAt(0)}
        </div>
        <div>
          <p className="text-base font-[Georgia,serif] text-[#0F0F0D] font-semibold leading-tight">
            {agent.name}
          </p>
          <p className="text-xs text-[#8A8680] mt-0.5">{agent.role}</p>
        </div>
      </div>

      {/* Status */}
      <AgentStatusBadge status={agent.status} />

      {/* Skills */}
      <div className="flex flex-wrap gap-1.5">
        {agent.skills.map((skill) => (
          <span
            key={skill}
            className="text-xs px-2 py-0.5 rounded-full bg-[#F5F5F3] text-[#8A8680] border border-[#E8E4DC]"
          >
            {skill}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-[#8A8680] pt-1 border-t border-[#E8E4DC]">
        <span>
          <span className="font-semibold text-[#0F0F0D]">{agent.tasksDone}</span> tâches
          ce mois
        </span>
        {agent.handoffsOut > 0 && agent.handoffTarget && (
          <span className="text-[#1A4E8C]">
            {agent.handoffsOut} passation{agent.handoffsOut > 1 ? "s" : ""} → {agent.handoffTarget}
          </span>
        )}
      </div>

      {/* Handoff indicator */}
      {agent.handoffsOut > 0 && agent.handoffTarget && (
        <HandoffIndicator
          from={agent.name}
          to={agent.handoffTarget}
          summary={`${agent.handoffsOut} candidats qualifiés passés à ${agent.handoffTarget} cette semaine`}
          className="text-xs"
        />
      )}

      {/* Arrow */}
      <div className="flex items-center gap-1 text-xs font-medium text-[#1A4E8C] opacity-0 group-hover:opacity-100 transition-opacity -mt-1">
        Voir la fiche <ArrowRight size={12} />
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Mon Équipe page
// ---------------------------------------------------------------------------

export default function MonEquipe() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">Mon équipe IA</h1>
          <p className="text-sm text-[#8A8680] mt-1">
            {agents.filter((a) => a.status === "actif").length} membres actifs ·{" "}
            {agents.reduce((s, a) => s + a.tasksDone, 0)} tâches complétées ce mois
          </p>
        </div>

        {/* Agent grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.slug}
              agent={agent}
              onClick={() => navigate(`/agents/${agent.slug}`)}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
