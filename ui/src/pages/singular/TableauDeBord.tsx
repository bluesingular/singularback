import * as React from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "@/lib/router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ApprovalBanner,
  IntelCard,
  UsageGauge,
  ActivityItem,
  TrustDot,
  AgentStatusBadge,
} from "@/components/singular"
import { useCompanyEvents } from "@/hooks/useCompanyEvents"
import { useCompany } from "../../context/CompanyContext"
import { agentsApi } from "@/api/agents"
import { dashboardApi } from "@/api/dashboard"
import { authApi } from "@/api/auth"
import { goalsApi } from "@/api/goals"
import { intelligenceApi, type IntelligenceCard } from "@/api/intelligence"
import { queryKeys } from "@/lib/queryKeys"
import { useLocale } from "@/hooks/useLocale"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLAN_TASK_LIMITS: Record<string, number> = {
  solo: 500, growth: 2000, pro: 6000, enterprise: 99999,
}

function cardTypeToIntelType(
  cardType: IntelligenceCard["cardType"],
): "insight" | "trust_proposal" | "relationship_gap" | "goal_alert" {
  switch (cardType) {
    case "trust":        return "trust_proposal"
    case "relationship": return "relationship_gap"
    case "goal":         return "goal_alert"
    default:             return "insight"
  }
}

function sseToActivity(event: { type: string; data: Record<string, unknown> }) {
  const agentName = (event.data.agentName ?? event.data.agent ?? "Agent") as string
  const action    = (event.data.action ?? event.data.title ?? "") as string
  const isLive    = event.type.startsWith("agent.")
  const outcome   = event.type === "task.completed" ? "approved" as const
                  : event.type === "task.blocked"   ? "pending"  as const
                  : undefined
  return { isLive, agentName, action, time: "maintenant", outcome }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function TableauDeBord() {
  const { t } = useTranslation("dashboard")
  const { t: tc } = useTranslation("common")
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { selectedCompanyId, selectedCompany } = useCompany()
  const { locale, timezone, formatNumber } = useLocale()

  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set())

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: authApi.getSession,
    staleTime: 60_000,
  })

  const { data: agentList } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  })

  const { data: summary } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  })

  const { data: intelCardsRaw } = useQuery({
    queryKey: ["intelligence-cards", selectedCompanyId],
    queryFn: () => intelligenceApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
  })

  const { data: goals } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
  })

  const markReadMutation = useMutation({
    mutationFn: ({ cardId }: { cardId: string }) =>
      intelligenceApi.markRead(selectedCompanyId!, cardId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["intelligence-cards", selectedCompanyId] }),
  })

  // ── SSE feed ───────────────────────────────────────────────────────────────

  const { connected, events: sseEvents, liveEvents } = useCompanyEvents()
  const liveActivity = liveEvents[0] ? sseToActivity(liveEvents[0]) : null
  const activities = React.useMemo(
    () => sseEvents.map(sseToActivity).slice(0, 10),
    [sseEvents],
  )

  // ── Derived values ─────────────────────────────────────────────────────────

  const firstName = session?.user?.name?.split(" ")[0] ?? null
  const plan      = selectedCompany?.plan ?? "growth"
  const taskLimit = PLAN_TASK_LIMITS[plan] ?? 2000
  const tasksDone = summary?.tasks.done ?? 0

  const pendingApprovals = summary?.pendingApprovals ?? 0

  const intelCards = (intelCardsRaw ?? [])
    .filter((c) => c.status !== "dismissed" && !dismissedIds.has(c.id))
    .slice(0, 3)

  const activeGoal  = goals?.find((g) => g.status === "active") ?? goals?.[0] ?? null
  const goalsTotal  = goals?.length ?? 0
  const goalsDone   = goals?.filter((g) => g.status === "achieved").length ?? 0

  const agents = (agentList ?? []).slice(0, 6)

  const today = new Date()
  const dateLabel = today.toLocaleDateString(locale, {
    weekday: "long", day: "numeric", month: "long", timeZone: timezone,
  })

  const taskTranslation = t("usage.taskSummary", { count: Math.max(0, taskLimit - tasksDone) })

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Escalation banner */}
        {pendingApprovals > 0 && (
          <ApprovalBanner
            count={pendingApprovals}
            onClick={() => navigate("/approvals/pending")}
          />
        )}

        {/* Header */}
        <section className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">
              {firstName ? `Good morning, ${firstName}` : "Good morning"}
            </h1>
            <p className="text-sm text-[#8A8680] mt-0.5">{dateLabel}</p>
          </div>
          {tasksDone > 0 ? (
            <p className="text-base text-[#0F0F0D]">
              Your team completed{" "}
              <span className="font-semibold text-[#1A9E68]">
                {tasksDone} task{tasksDone !== 1 ? "s" : ""}
              </span>{" "}
              this month.
            </p>
          ) : (
            <p className="text-base text-[#8A8680]">
              No tasks completed yet this month.{" "}
              <a href="console" className="text-[#1A4E8C] hover:underline">Give your team an instruction →</a>
            </p>
          )}
          <UsageGauge
            used={tasksDone}
            limit={taskLimit}
            translation={taskTranslation}
            className="max-w-sm"
          />
        </section>

        {/* Morning intelligence */}
        {intelCards.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">
                This morning
              </h2>
              <span className="text-xs text-[#8A8680]">
                {intelCards.length} insight{intelCards.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {intelCards.map((card) => (
                <IntelCard
                  key={card.id}
                  type={cardTypeToIntelType(card.cardType)}
                  headline={card.title}
                  body={card.body}
                  cta={tc("actions.view")}
                  urgency={card.urgency}
                  onCta={() => {
                    markReadMutation.mutate({ cardId: card.id })
                    if (card.actionUrl) navigate(card.actionUrl)
                  }}
                  onDismiss={() => {
                    setDismissedIds((prev) => new Set([...prev, card.id]))
                    markReadMutation.mutate({ cardId: card.id })
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Left: Recent activity */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">
                Recent activity
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
                  time="now"
                  isLive={true}
                  className="px-4"
                />
              )}
              {activities.map((item, i) => (
                <ActivityItem
                  key={i}
                  agentName={item.agentName}
                  action={item.action}
                  time={item.time}
                  isLive={item.isLive}
                  outcome={item.outcome}
                  className="px-4"
                />
              ))}
              {!liveActivity && activities.length === 0 && (
                <p className="px-4 py-6 text-sm text-[#8A8680] text-center">
                  No activity yet. Your team's work will appear here in real time.
                </p>
              )}
            </div>
          </section>

          {/* Right: My team */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-[Georgia,serif] text-[#0F0F0D]">My team</h2>
            <div className="bg-white rounded-xl border border-[#E8E4DC] shadow-sm divide-y divide-[#E8E4DC]">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => navigate(`/agents/${agent.urlKey}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF8] transition-colors text-left"
                >
                  <div
                    className={[
                      "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold",
                      agent.status === "active" ? "bg-[#1A9E68]" : "bg-[#8A8680]",
                    ].join(" ")}
                  >
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F0F0D]">{agent.name}</p>
                    <p className="text-xs text-[#8A8680] truncate">
                      {agent.status === "active"
                        ? tc("agentStatus.active")
                        : tc("agentStatus.paused")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <AgentStatusBadge status={agent.status === "active" ? "actif" : "pause"} />
                    <TrustDot level="building" />
                  </div>
                </button>
              ))}
              {agents.length === 0 && (
                <p className="px-4 py-6 text-sm text-[#8A8680] text-center">
                  No agents yet. Install a pack to get started.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Current goal */}
        {activeGoal && (
          <section className="bg-[#1A9E68] rounded-xl p-5 text-white flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-[Georgia,serif]">Current goal</h2>
                <p className="text-sm text-white/80 mt-0.5">{activeGoal.title}</p>
              </div>
              {goalsTotal > 0 && (
                <span className="text-2xl font-bold font-[Georgia,serif]">
                  {goalsDone}/{goalsTotal}
                </span>
              )}
            </div>
            {goalsTotal > 0 && (
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${(goalsDone / goalsTotal) * 100}%` }}
                />
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  )
}
