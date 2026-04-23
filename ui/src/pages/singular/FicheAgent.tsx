import * as React from "react"
import { ArrowLeft, Pause, Play, ArrowRight } from "lucide-react"
import { useParams, useNavigate } from "@/lib/router"
import { cn } from "@/lib/utils"
import {
  TrustDot,
  TrustBar,
  AgentStatusBadge,
  HandoffIndicator,
} from "@/components/singular"
import { Button } from "@/components/ui/button"

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface AgentData {
  slug: string
  name: string
  role: string
  status: "actif" | "pause"
  trust: "trusted" | "upgrade" | "building"
  trustScore: number
  trustLabel: string
  autonomyLevel: "Supervisée" | "De confiance" | "Très autonome" | "En construction"
  autonomyDescription: string
  streak: number // consecutive 4+ star approvals
  streakTarget: number
  skills: string[]
  handoffsOut: { to: string; summary: string }[]
  handoffsIn: { from: string; summary: string }[]
  recentTasks: {
    title: string
    status: "terminé" | "en cours" | "en attente"
    rating?: number
    time: string
  }[]
  streakNote: string
  trustNote: string
}

const SOPHIE: AgentData = {
  slug: "sophie",
  name: "Sophie",
  role: "Chargée de sourcing",
  status: "actif",
  trust: "upgrade",
  trustScore: 4.8,
  trustLabel: "4,8 / 5",
  autonomyLevel: "Supervisée",
  autonomyDescription: "Vous validez chaque sélection avant qu'elle soit transmise.",
  streak: 7,
  streakTarget: 10,
  skills: ["Qualification CV", "Sourcing de candidats", "Relance candidats"],
  handoffsOut: [
    { to: "Marc", summary: "3 candidats qualifiés passés à Marc pour présentation client" },
  ],
  handoffsIn: [
    { from: "Marc", summary: "Relancer la shortlist React Senior reçue de Marc" },
  ],
  recentTasks: [
    { title: "Sélection de CV — Mission React Senior", status: "terminé", rating: 5, time: "il y a 2h" },
    { title: "Relance de candidats — Mission Data Analyst", status: "terminé", rating: 4, time: "hier" },
    { title: "Sourcing LinkedIn — Mission DevOps", status: "en cours", time: "en cours" },
    { title: "Qualification CV — Mission Product Manager", status: "terminé", rating: 5, time: "il y a 3j" },
    { title: "Sélection de CV — Mission UX Designer", status: "terminé", rating: 4, time: "il y a 5j" },
  ],
  streakNote: "7 validations consécutives 4+★ → proposition d'autonomie à 10",
  trustNote: "★★★★★  6 semaines consécutives au-dessus de 4,5/5",
}

function genericAgent(slug: string): AgentData {
  const nameMap: Record<string, { name: string; role: string; skills: string[] }> = {
    marc: { name: "Marc", role: "Responsable relation client", skills: ["Email client", "Rapport hebdo"] },
    clara: { name: "Clara", role: "Chargée de contenu", skills: ["Rédaction offres", "Posts LinkedIn"] },
    julien: { name: "Julien", role: "Assistant administratif", skills: ["Suivi candidats"] },
    iris: { name: "Iris", role: "Analyste marché", skills: ["Veille marché"] },
  }
  const info = nameMap[slug] ?? { name: slug, role: "Agent IA", skills: [] }
  return {
    slug,
    ...info,
    status: "actif",
    trust: "building",
    trustScore: 3.2,
    trustLabel: "3,2 / 5",
    autonomyLevel: "Supervisée",
    autonomyDescription: "Vous validez chaque action avant exécution.",
    streak: 2,
    streakTarget: 10,
    handoffsOut: [],
    handoffsIn: [],
    recentTasks: [
      { title: "Tâche récente", status: "terminé", rating: 4, time: "hier" },
      { title: "Tâche en cours", status: "en cours", time: "maintenant" },
    ],
    streakNote: "2 validations consécutives 4+★",
    trustNote: "Historique en cours de construction",
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-[#C97C0A] text-sm">
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
    </span>
  )
}

function TaskRow({
  task,
}: {
  task: AgentData["recentTasks"][number]
}) {
  const statusConfig: Record<
    AgentData["recentTasks"][number]["status"],
    { label: string; classes: string }
  > = {
    terminé: { label: "Terminé", classes: "text-[#1A9E68] bg-[#ECFBF4]" },
    "en cours": { label: "En cours", classes: "text-[#1A4E8C] bg-[#EFF3FA]" },
    "en attente": { label: "En attente", classes: "text-[#C97C0A] bg-[#FFF8EC]" },
  }
  const cfg = statusConfig[task.status]

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F0F0D] truncate">{task.title}</p>
        <p className="text-xs text-[#8A8680] mt-0.5">{task.time}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.rating !== undefined && <StarRating rating={task.rating} />}
        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cfg.classes)}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FicheAgent() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [paused, setPaused] = React.useState(false)

  const agent = slug === "sophie" ? SOPHIE : genericAgent(slug ?? "inconnu")

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Back */}
        <button
          onClick={() => navigate("/equipe")}
          className="flex items-center gap-1.5 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Mon équipe
        </button>

        {/* Header */}
        <section className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5 flex items-start gap-4">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-semibold flex-shrink-0",
              paused || agent.status === "pause" ? "bg-[#8A8680]" : "bg-[#1A9E68]"
            )}
          >
            {agent.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-[Georgia,serif] text-[#0F0F0D]">{agent.name}</h1>
              <TrustDot level={agent.trust} />
            </div>
            <p className="text-sm text-[#8A8680]">{agent.role}</p>
            <div className="mt-2">
              <AgentStatusBadge status={paused ? "pause" : agent.status} />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            className="flex-shrink-0 text-xs gap-1.5 border-[#E8E4DC]"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? "Reprendre" : "Mettre en pause"}
          </Button>
        </section>

        {/* Capacités */}
        <section className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5 flex flex-col gap-3">
          <h2 className="text-base font-[Georgia,serif] text-[#0F0F0D]">Capacités</h2>
          <div className="flex flex-wrap gap-2">
            {agent.skills.map((skill) => (
              <span
                key={skill}
                className="text-sm px-3 py-1 rounded-full bg-[#EFF3FA] text-[#1A4E8C] border border-[#1A4E8C]/15 font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>

        {/* Confiance & Autonomie */}
        <section className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5 flex flex-col gap-4">
          <h2 className="text-base font-[Georgia,serif] text-[#0F0F0D]">
            Confiance &amp; Autonomie
          </h2>

          {/* Trust summary */}
          <div className="bg-[#FAFAF8] rounded-xl p-4 flex flex-col gap-2 border border-[#E8E4DC]">
            <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide">
              Bilan de confiance
            </p>
            <p className="text-sm font-semibold text-[#0F0F0D]">
              {agent.name} · {agent.skills[0]}
            </p>
            <p className="text-sm text-[#0F0F0D]">{agent.trustNote}</p>
            <p className="text-sm text-[#8A8680]">
              ★★★★½&nbsp;&nbsp;{agent.recentTasks.filter((t) => t.rating).length * 10} lots
              validés par vous
            </p>
            {agent.trust === "upgrade" && (
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1A4E8C] flex-shrink-0" />
                <span className="text-sm text-[#1A4E8C] font-medium">
                  Prête pour un niveau d'autonomie supérieur
                </span>
              </div>
            )}
            {agent.trust === "upgrade" && (
              <button
                onClick={() => navigate("/confiance")}
                className="flex items-center gap-1 text-sm font-medium text-[#1A4E8C] hover:underline mt-1 w-fit"
              >
                Voir la proposition <ArrowRight size={13} />
              </button>
            )}
          </div>

          {/* Trust bar */}
          <TrustBar score={agent.trustScore} label={agent.trustLabel} />

          {/* Autonomy level */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#0F0F0D]">
                Niveau actuel :
              </span>
              <span className="text-sm font-medium text-[#C97C0A]">
                {agent.autonomyLevel}
              </span>
            </div>
            <p className="text-sm text-[#8A8680]">{agent.autonomyDescription}</p>
          </div>

          {/* Streak progress */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-[#8A8680]">
              <span>{agent.streakNote}</span>
              <span className="font-semibold text-[#0F0F0D]">
                {agent.streak}/{agent.streakTarget}
              </span>
            </div>
            <div className="h-2 bg-[#E8E4DC] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1A4E8C] rounded-full transition-all"
                style={{ width: `${(agent.streak / agent.streakTarget) * 100}%` }}
              />
            </div>
            <p className="text-xs text-[#8A8680]">
              {agent.streakTarget - agent.streak} validations consécutives 4+★ avant la
              prochaine proposition d'autonomie
            </p>
          </div>
        </section>

        {/* Passations cette semaine */}
        {(agent.handoffsOut.length > 0 || agent.handoffsIn.length > 0) && (
          <section className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5 flex flex-col gap-3">
            <h2 className="text-base font-[Georgia,serif] text-[#0F0F0D]">
              Passations cette semaine
            </h2>
            <div className="flex flex-col gap-2">
              {agent.handoffsOut.map((h, i) => (
                <HandoffIndicator
                  key={`out-${i}`}
                  from={agent.name}
                  to={h.to}
                  summary={h.summary}
                />
              ))}
              {agent.handoffsIn.map((h, i) => (
                <HandoffIndicator
                  key={`in-${i}`}
                  from={h.from}
                  to={agent.name}
                  summary={h.summary}
                />
              ))}
            </div>
          </section>
        )}

        {/* Tâches récentes */}
        <section className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5 flex flex-col gap-3">
          <h2 className="text-base font-[Georgia,serif] text-[#0F0F0D]">Tâches récentes</h2>
          <div className="divide-y divide-[#E8E4DC]">
            {agent.recentTasks.map((task, i) => (
              <TaskRow key={i} task={task} />
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
