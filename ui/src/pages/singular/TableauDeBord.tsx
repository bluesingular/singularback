import * as React from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "@/lib/router"
import {
  ApprovalBanner,
  IntelCard,
  UsageGauge,
  ActivityItem,
  TrustDot,
  AgentStatusBadge,
} from "@/components/singular"
import { useCompanyEvents } from "@/hooks/useCompanyEvents"

// ---------------------------------------------------------------------------
// Static seed data (shown before any live events arrive)
// ---------------------------------------------------------------------------

const agents = [
  { name: "Sophie", role: "Sourcing", status: "actif" as const, trust: "trusted" as const, action: "Qualifie des CV..." },
  { name: "Marc", role: "Relation client", status: "actif" as const, trust: "building" as const, action: "Rédige un rapport" },
  { name: "Clara", role: "Contenu", status: "pause" as const, trust: "building" as const, action: "En pause" },
  { name: "Julien", role: "Administratif", status: "actif" as const, trust: "building" as const, action: "Suit les dossiers" },
  { name: "Iris", role: "Veille marché", status: "actif" as const, trust: "building" as const, action: "Analyse le marché" },
]

const SEED_ACTIVITIES = [
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

// Translate SSE event data into ActivityItem-compatible shape
function sseToActivity(event: { type: string; data: Record<string, unknown> }) {
  const agentName = (event.data.agentName ?? event.data.agent ?? "Agent") as string
  const action    = (event.data.action ?? event.data.title ?? "") as string
  const isLive    = event.type.startsWith("agent.")
  const outcome   = event.type === "task.completed" ? "approved" as const
                  : event.type === "task.blocked"   ? "pending" as const
                  : undefined
  return { isLive, agentName, action, time: "maintenant", outcome }
}

export default function TableauDeBord() {
  const { t, i18n } = useTranslation("dashboard")
  const { t: tc } = useTranslation("common")
  const navigate = useNavigate()

  const [dismissedCards, setDismissedCards] = React.useState<number[]>([])

  // Live SSE feed — prepends real events to the seed list
  const { connected, events: sseEvents, liveEvents } = useCompanyEvents()
  const liveActivity = liveEvents[0] ? sseToActivity(liveEvents[0]) : null
  const activities = React.useMemo(() => {
    const live = sseEvents.map(sseToActivity)
    return [...live, ...SEED_ACTIVITIES].slice(0, 10)
  }, [sseEvents])

  function dismiss(idx: number) {
    setDismissedCards((prev) => [...prev, idx])
  }

  const today = new Date()
  const dateLabel = today.toLocaleDateString(i18n.language === "en" ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  const intelCards = [
    {
      type: "insight" as const,
      headline: "Sophie n'a placé aucun candidat depuis 18 jours",
      body: "40 % sous votre rythme habituel sur la même période.",
      cta: tc("actions.view"),
      urgency: 3,
      onCta: () => navigate("/agents/sophie"),
    },
    {
      type: "trust_proposal" as const,
      headline: "Sophie qualifie les CV à 4,8/5 depuis 6 semaines",
      body: "Elle est prête pour un niveau d'autonomie supérieur.",
      cta: tc("actions.view"),
      urgency: 2,
      onCta: () => navigate("/confiance"),
    },
    {
      type: "relationship_gap" as const,
      headline: "Buildtech n'a pas reçu de rapport depuis 12 jours",
      body: "Leur contrat se renouvelle dans 30 jours.",
      cta: tc("actions.view"),
      urgency: 2,
      onCta: () => navigate("/agents/marc"),
    },
  ]

  const visibleCards = intelCards.filter((_, i) => !dismissedCards.includes(i))

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
              {t("title")}, Marie 👋
            </h1>
            <p className="text-sm text-[#8A8680] mt-0.5">{dateLabel}</p>
          </div>
          <p className="text-base text-[#0F0F0D]">
            {i18n.language === "en"
              ? <>Your team completed <span className="font-semibold text-[#1A9E68]">47 tasks</span> this weekend.</>
              : <>Votre équipe a complété <span className="font-semibold text-[#1A9E68]">47 tâches</span> ce week-end.</>
            }
          </p>
          <UsageGauge
            used={847}
            limit={2000}
            translation={i18n.language === "en" ? "~95 CV batches remaining" : "environ 95 sélections de CV restantes"}
            className="max-w-sm"
          />
        </section>

        {/* Intelligence du matin */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">
              {t("morning.title")}
            </h2>
            {visibleCards.length > 0 && (
              <span className="text-xs text-[#8A8680]">
                {t("morning.count", { count: visibleCards.length })}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {visibleCards.map((card, i) => (
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
                {t("morning.cleared")}
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
                {t("activity.title")}
              </h2>
              {connected && (
                <span className="flex items-center gap-1 text-xs font-semibold text-[#B91C1C] bg-[#FEF2F2] px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C] animate-pulse" />
                  {tc("status.live")}
                </span>
              )}
            </div>
            <div className="bg-white rounded-xl border border-[#E8E4DC] shadow-sm divide-y divide-[#E8E4DC]">
              {liveActivity && (
                <ActivityItem
                  key="live"
                  agentName={liveActivity.agentName}
                  action={liveActivity.action}
                  time="maintenant"
                  isLive={true}
                  className="px-4"
                />
              )}
              {activities.map((item, i) => (
                <ActivityItem
                  key={i}
                  agentName={item.agentName}
                  action={item.action}
                  detail={(item as any).detail}
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
            <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">{t("team.title")}</h2>
            <div className="bg-white rounded-xl border border-[#E8E4DC] shadow-sm divide-y divide-[#E8E4DC]">
              {agents.map((agent) => (
                <button
                  key={agent.name}
                  onClick={() =>
                    navigate(`/agents/${agentSlugMap[agent.name] ?? agent.name.toLowerCase()}`)
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF8] transition-colors text-left"
                >
                  <div
                    className={[
                      "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold",
                      agent.status === "actif" ? "bg-[#1A9E68]" : "bg-[#8A8680]",
                    ].join(" ")}
                  >
                    {agent.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F0F0D]">{agent.name}</p>
                    <p className="text-xs text-[#8A8680] truncate">{agent.action}</p>
                  </div>
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
              <h2 className="text-lg font-[Georgia,serif]">{t("goal.title")}</h2>
              <p className="text-sm text-white/80 mt-0.5">
                {i18n.language === "en"
                  ? "Place 8 permanent contracts by April 30"
                  : "Placer 8 candidats en CDI avant le 30 avril"}
              </p>
            </div>
            <span className="text-2xl font-bold font-[Georgia,serif]">5/8</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${(5 / 8) * 100}%` }}
            />
          </div>
          <p className="text-xs text-white/70">
            {t("goal.remaining", { count: 3, days: 8 })}
          </p>
        </section>

      </div>
    </div>
  )
}
