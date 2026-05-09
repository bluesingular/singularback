import * as React from "react"
import { useTranslation } from "react-i18next"
import { ArrowRight } from "lucide-react"
import { useNavigate } from "@/lib/router"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { TrustDot, AgentStatusBadge } from "@/components/singular"
import { useCompany } from "../../context/CompanyContext"
import { agentsApi } from "@/api/agents"
import { queryKeys } from "@/lib/queryKeys"
import type { Agent } from "@paperclipai/shared"

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const { t } = useTranslation("agents")
  const { t: tc } = useTranslation("common")
  const isActive = agent.status === "active"
  const avatarBg = isActive ? "bg-[#1A9E68]" : "bg-[#8A8680]"

  return (
    <button
      onClick={onClick}
      className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md hover:border-[#1A9E68]/30 transition-all text-left relative group"
    >
      <div className="absolute top-4 right-4">
        <TrustDot level="building" />
      </div>

      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-semibold flex-shrink-0", avatarBg)}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-base font-[Georgia,serif] text-[#0F0F0D] font-semibold leading-tight">
            {agent.name}
          </p>
          <p className="text-xs text-[#8A8680] mt-0.5">
            {isActive ? tc("agentStatus.active") : tc("agentStatus.paused")}
          </p>
        </div>
      </div>

      <AgentStatusBadge status={isActive ? "actif" : "pause"} />

      <div className="flex items-center gap-1 text-xs font-medium text-[#1A4E8C] opacity-0 group-hover:opacity-100 transition-opacity">
        {t("card.viewProfile")} <ArrowRight size={12} />
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MonEquipe() {
  const { t } = useTranslation("agents")
  const { t: tc } = useTranslation("common")
  const navigate = useNavigate()
  const { selectedCompanyId } = useCompany()

  const { data: agentList, isLoading } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  })

  const agents = agentList ?? []
  const activeCount = agents.filter((a) => a.status === "active").length

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">

        <div>
          <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">{t("team.titleAI")}</h1>
          <p className="text-sm text-[#8A8680] mt-1">
            {isLoading
              ? "…"
              : t("team.activeCount", { count: activeCount, tasks: agents.length })}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-[#E8E4DC] rounded-2xl p-5 h-40 animate-pulse" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E4DC] p-10 text-center">
            <p className="text-sm text-[#8A8680]">
              {tc("agentStatus.empty")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => navigate(`/agents/${agent.urlKey}`)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
