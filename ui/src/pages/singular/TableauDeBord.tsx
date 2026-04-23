import * as React from "react"
import { useNavigate } from "@/lib/router"
import {
  ApprovalBanner,
  IntelCard,
  UsageGauge,
  ActivityItem,
  TrustDot,
  AgentStatusBadge,
} from "@/components/singular"

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const agents = [
  { name: "Sophie", role: "Sourcing", status: "actif" as const, trust: "trusted" as const, action: "Qualifie des CV..." },
  { name: "Marc", role: "Relation client", status: "actif" as const, trust: "building" as const, action: "Rédige un rapport" },
  { name: "Clara", role: "Contenu", status: "pause" as const, trust: "building" as const, action: "En pause" },
  { name: "Julien", role: "Administratif", status: "actif" as const, trust: "building" as const, action: "Suit les dossiers" },
  { name: "Iris", role: "Veille marché", status: "actif" as const, trust: "building" as const, action: "Analyse le marché" },
]

const activities = [
  { isLive: true, agentName: "Sophie", action: "lit le CV de Martin Dupont...", time: "maintenant", outcome: undefined },
  { isLive: false, agentName: "Sophie", action: "a qualifié Julia Mercier", outcome: "approved" as const, time: "il y a 2 min", detail: "★★★★★" },
  { isLive: false, agentName: "Sophie", action: "a passé le dossier à Marc", outcome: "sent" as const, time: "il y a 14 min" },
  { isLive: false, agentName: "Marc", action: "a envoyé le rapport Innotec", outcome: "sent" as const, time: "il y a 2h" },
  { isLive: false, agentName: "Clara", action: "a rédigé 3 posts LinkedIn", outcome: "pending" as const, time: "hier 18h47" },
]

const agentSlugMap: Record<string, string> = {
  Sophie: "sophie",
  Marc: "marc",
  Clara: "clara",
  Julien: "julien",
  Iris: "iris",
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function TableauDeBord() {
  const navigate = useNavigate()

  const [dismissedCards, setDismissedCards] = React.useState<number[]>([])

  function dismiss(idx: number) {
    setDismissedCards((prev) => [...prev, idx])
  }

  const today = new Date()
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
  const monthNames = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ]
  const dateLabel = `${dayNames[today.getDay()]} ${today.getDate()} ${monthNames[today.getMonth()]}`

  const intelCards = [
    {
      type: "insight" as const,
      headline: "Sophie n'a placé aucun candidat depuis 18 jours",
      body: "40 % sous votre rythme habituel sur la même période.",
      cta: "Analyser",
      urgency: 3,
      onCta: () => navigate("/agents/sophie"),
    },
    {
      type: "trust_proposal" as const,
      headline: "Sophie qualifie les CV à 4,8/5 depuis 6 semaines",
      body: "Elle est prête pour un niveau d'autonomie supérieur.",
      cta: "Voir la proposition",
      urgency: 2,
      onCta: () => navigate("/confiance"),
    },
    {
      type: "relationship_gap" as const,
      headline: "Buildtech n'a pas reçu de rapport depuis 12 jours",
      body: "Leur contrat se renouvelle dans 30 jours.",
      cta: "Déléguer à Marc",
      urgency: 2,
      onCta: () => navigate("/agents/marc"),
    },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Escalation banner */}
        <ApprovalBanner
          count={2}
          onClick={() => navigate("/approbations")}
        />

        {/* Header */}
        <section className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">
              Bonjour, Marie 👋
            </h1>
            <p className="text-sm text-[#8A8680] mt-0.5">{dateLabel}</p>
          </div>
          <p className="text-base text-[#0F0F0D]">
            Votre équipe a complété{" "}
            <span className="font-semibold text-[#1A9E68]">47 tâches</span> ce
            week-end.
          </p>
          <UsageGauge
            used={847}
            limit={2000}
            translation="environ 95 sélections de CV restantes"
            className="max-w-sm"
          />
        </section>

        {/* Intelligence du matin */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">
              Intelligence du matin
            </h2>
            <span className="text-xs text-[#8A8680]">
              {intelCards.length - dismissedCards.length} nouvelles
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {intelCards
              .filter((_, i) => !dismissedCards.includes(i))
              .map((card, i) => (
                <IntelCard
                  key={i}
                  type={card.type}
                  headline={card.headline}
                  body={card.body}
                  cta={card.cta}
                  urgency={card.urgency}
                  onCta={card.onCta}
                  onDismiss={() => dismiss(i)}
                />
              ))}
            {dismissedCards.length === intelCards.length && (
              <p className="text-sm text-[#8A8680] py-2">
                Toutes les suggestions du jour ont été traitées.
              </p>
            )}
          </div>
        </section>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Left: Activité récente */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">
                Activité récente
              </h2>
              <span className="flex items-center gap-1 text-xs font-semibold text-[#B91C1C] bg-[#FEF2F2] px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C] animate-pulse" />
                En direct
              </span>
            </div>
            <div className="bg-white rounded-xl border border-[#E8E4DC] shadow-sm divide-y divide-[#E8E4DC]">
              {activities.map((item, i) => (
                <ActivityItem
                  key={i}
                  agentName={item.agentName}
                  action={item.action}
                  detail={item.detail}
                  time={item.time}
                  isLive={item.isLive}
                  outcome={item.outcome}
                  className="px-4"
                />
              ))}
            </div>
          </section>

          {/* Right: Mon équipe */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">Mon équipe</h2>
            <div className="bg-white rounded-xl border border-[#E8E4DC] shadow-sm divide-y divide-[#E8E4DC]">
              {agents.map((agent) => (
                <button
                  key={agent.name}
                  onClick={() =>
                    navigate(`/agents/${agentSlugMap[agent.name] ?? agent.name.toLowerCase()}`)
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF8] transition-colors text-left"
                >
                  {/* Avatar */}
                  <div
                    className={[
                      "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold",
                      agent.status === "actif" ? "bg-[#1A9E68]" : "bg-[#8A8680]",
                    ].join(" ")}
                  >
                    {agent.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F0F0D]">{agent.name}</p>
                    <p className="text-xs text-[#8A8680] truncate">{agent.action}</p>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <AgentStatusBadge status={agent.status} />
                    <TrustDot level={agent.trust} />
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Objectif principal */}
        <section className="bg-[#1A9E68] rounded-xl p-5 text-white flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-[Georgia,serif]">Objectif du mois</h2>
              <p className="text-sm text-white/80 mt-0.5">
                Placer 8 candidats en CDI avant le 30 avril
              </p>
            </div>
            <span className="text-2xl font-bold font-[Georgia,serif]">5/8</span>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${(5 / 8) * 100}%` }}
            />
          </div>
          <p className="text-xs text-white/70">
            3 placements restants · 8 jours avant la fin du mois
          </p>
        </section>

      </div>
    </div>
  )
}
