import * as React from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Pause, Play, ArrowRight, Settings } from "lucide-react"
import { useParams, useNavigate } from "@/lib/router"
import { cn } from "@/lib/utils"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  TrustDot,
  TrustBar,
  AgentStatusBadge,
} from "@/components/singular"
import { Button } from "@/components/ui/button"
import { useCompany } from "../../context/CompanyContext"
import { agentsApi } from "@/api/agents"
import { trustApi, type TrustScore } from "@/api/trust"
import { queryKeys } from "@/lib/queryKeys"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function trustDotLevel(level: string): "trusted" | "upgrade" | "building" {
  if (level === "highlyTrusted") return "trusted"
  if (level === "trusted")       return "upgrade"
  return "building"
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FicheAgent() {
  const { t } = useTranslation("agents")

  function autonomyLabel(level: string): string {
    const key = level as "highlyTrusted" | "trusted" | "supervised" | "building"
    return t(`autonomy.${key}`, t("autonomy.building"))
  }

  function autonomyDescription(level: string): string {
    const key = level as "highlyTrusted" | "trusted" | "supervised" | "building"
    return t(`autonomy.${key}_desc`, t("autonomy.building_desc"))
  }
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { selectedCompanyId } = useCompany()

  // ── Fetch agent ────────────────────────────────────────────────────────────

  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery({
    queryKey: [...queryKeys.agents.list(selectedCompanyId!), slug],
    queryFn: () => agentsApi.get(slug!, selectedCompanyId!),
    enabled: !!selectedCompanyId && !!slug,
    staleTime: 30_000,
  })

  // ── Fetch trust for this company, filter by agentId ───────────────────────

  const { data: trustData } = useQuery({
    queryKey: ["trust", selectedCompanyId],
    queryFn: () => trustApi.getCompanyTrust(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  })

  const agentScores: TrustScore[] = React.useMemo(
    () => (trustData?.scores ?? []).filter((s) => s.agentId === agent?.id),
    [trustData, agent?.id],
  )

  const hasTrustProposal = (trustData?.proposals ?? []).some(
    (p) => p.agentId === agent?.id && p.status === "pending",
  )

  const topScore = agentScores.length > 0
    ? agentScores.reduce((best, s) => (s.score > best.score ? s : best))
    : null

  // ── Pause / Resume ─────────────────────────────────────────────────────────

  const pauseMutation = useMutation({
    mutationFn: () => agentsApi.pause(agent!.id, selectedCompanyId ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) }),
  })

  const resumeMutation = useMutation({
    mutationFn: () => agentsApi.resume(agent!.id, selectedCompanyId ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) }),
  })

  // ── Derived ────────────────────────────────────────────────────────────────

  const isActive = agent?.status === "active"
  const isPending = pauseMutation.isPending || resumeMutation.isPending

  const autonomyLevel = topScore?.autonomyLevel ?? "building"
  const streak        = topScore?.approvalStreak ?? 0
  const streakTarget  = 10
  const scoreVal      = topScore?.score ?? 0
  const scoreLabel    = `${Number(scoreVal).toFixed(1).replace(".", ",")} / 5`

  // ── Render ─────────────────────────────────────────────────────────────────

  if (agentLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <p className="text-sm text-[#8A8680]">Chargement…</p>
      </div>
    )
  }

  if (agentError || !agent) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
          <button
            onClick={() => navigate("/equipe")}
            className="flex items-center gap-1.5 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors w-fit"
          >
            <ArrowLeft size={14} /> {t("team.title")}
          </button>
          <div className="bg-white rounded-2xl border border-[#E8E4DC] p-10 text-center">
            <p className="text-sm text-[#8A8680]">
              {t("detail.notFound")}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Back */}
        <button
          onClick={() => navigate("/equipe")}
          className="flex items-center gap-1.5 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors w-fit"
        >
          <ArrowLeft size={14} /> {t("team.title")}
        </button>

        {/* Header */}
        <section className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5 flex items-start gap-4">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-semibold flex-shrink-0",
              isActive ? "bg-[#1A9E68]" : "bg-[#8A8680]",
            )}
          >
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-[Georgia,serif] text-[#0F0F0D]">{agent.name}</h1>
              <TrustDot level={trustDotLevel(autonomyLevel)} />
            </div>
            {agent.title && <p className="text-sm text-[#8A8680]">{agent.title}</p>}
            <div className="mt-2">
              <AgentStatusBadge status={isActive ? "actif" : "pause"} />
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`config`)}
              className="text-xs gap-1.5 border-[#E8E4DC]"
            >
              <Settings size={12} />
              Configurer
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => isActive ? pauseMutation.mutate() : resumeMutation.mutate()}
              className="text-xs gap-1.5 border-[#E8E4DC]"
            >
              {isActive ? <Pause size={12} /> : <Play size={12} />}
              {isActive ? t("detail.pause") : t("detail.resume")}
            </Button>
          </div>
        </section>

        {/* Capacités */}
        {agent.capabilities && (
          <section className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5 flex flex-col gap-3">
            <h2 className="text-base font-[Georgia,serif] text-[#0F0F0D]">{t("detail.capacites")}</h2>
            <p className="text-sm text-[#8A8680] whitespace-pre-line">{agent.capabilities}</p>
          </section>
        )}

        {/* Confiance & Autonomie */}
        <section className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5 flex flex-col gap-4">
          <h2 className="text-base font-[Georgia,serif] text-[#0F0F0D]">
            {t("detail.trustAndAutonomy")}
          </h2>

          {agentScores.length === 0 ? (
            <p className="text-sm text-[#8A8680]">
              {t("detail.trustEmpty")}
            </p>
          ) : (
            <>
              {/* Trust score per skill */}
              <div className="flex flex-col gap-3">
                {agentScores.map((score, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs text-[#8A8680]">
                      <span className="font-medium">{score.skillType}</span>
                      <span>{Number(score.score).toFixed(1).replace(".", ",")} / 5</span>
                    </div>
                    <TrustBar
                      score={score.score}
                      label={`${Number(score.score).toFixed(1).replace(".", ",")} / 5`}
                    />
                  </div>
                ))}
              </div>

              {/* Top score summary */}
              {topScore && (
                <TrustBar score={scoreVal} label={scoreLabel} />
              )}

              {hasTrustProposal && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1A4E8C] flex-shrink-0" />
                  <span className="text-sm text-[#1A4E8C] font-medium">
                    {t("detail.upgradeReady")}
                  </span>
                </div>
              )}
              {hasTrustProposal && (
                <button
                  onClick={() => navigate("/confiance")}
                  className="flex items-center gap-1 text-sm font-medium text-[#1A4E8C] hover:underline w-fit"
                >
                  {t("detail.viewProposal")} <ArrowRight size={13} />
                </button>
              )}

              {/* Autonomy level */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#0F0F0D]">
                    {t("detail.currentLevel")} :
                  </span>
                  <span className="text-sm font-medium text-[#C97C0A]">
                    {autonomyLabel(autonomyLevel)}
                  </span>
                </div>
                <p className="text-sm text-[#8A8680]">{autonomyDescription(autonomyLevel)}</p>
              </div>

              {/* Streak progress */}
              {streak > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-[#8A8680]">
                    <span>
                      {t("detail.streakLabel", { count: streak })}
                    </span>
                    <span className="font-semibold text-[#0F0F0D]">{streak}/{streakTarget}</span>
                  </div>
                  <div className="h-2 bg-[#E8E4DC] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1A4E8C] rounded-full transition-all"
                      style={{ width: `${Math.min(100, (streak / streakTarget) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#8A8680]">
                    {t("detail.streakRemaining", { count: Math.max(0, streakTarget - streak) })}
                  </p>
                </div>
              )}
            </>
          )}
        </section>

      </div>
    </div>
  )
}
