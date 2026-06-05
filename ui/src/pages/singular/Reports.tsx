import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Clock, Euro, Users, Share2, ChevronDown } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { dashboardApi } from "@/api/dashboard";
import { agentsApi } from "@/api/agents";
import { queryKeys } from "@/lib/queryKeys";
import { useLocale } from "@/hooks/useLocale";

const AGENT_COLORS = [
  "#1A9E68", "#1A4E8C", "#C97C0A", "#6B7280", "#7C3AED",
  "#D97706", "#0EA5E9", "#EC4899",
];

export function Reports() {
  const { t } = useTranslation("reports");
  const { t: tc } = useTranslation("common");
  const { selectedCompanyId } = useCompany();
  const { formatNumber, formatEuros } = useLocale();

  const periods = [t("periods.thisMonth"), t("periods.lastMonth"), t("periods.last3Months")];
  const [period, setPeriod] = useState(() => t("periods.thisMonth"));
  const [fteCount, setFteCount] = useState(1.2);

  const { data: summary } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  });

  const { data: agentList } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  });

  const tasksDone   = summary?.tasks.done ?? 0;
  const costCents   = summary?.costs.monthSpendCents ?? 0;
  const budgetCents = summary?.costs.monthBudgetCents ?? 0;
  const costEuros   = Math.round(costCents / 100);
  const hoursSaved  = Math.round((tasksDone * 5) / 60); // ~5 min per task

  const monthlyCostHuman = Math.round(fteCount * 2800 * 1.45);
  const monthlyCostAI    = Math.max(costEuros, 1);
  const savings          = Math.max(0, monthlyCostHuman - monthlyCostAI);

  const agents = (agentList ?? []).slice(0, 8);


  return (
    <div className="min-h-screen px-6 py-6" style={{ backgroundColor: "#FAFAF8" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl" style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}>
          {t("title")}
        </h1>
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="appearance-none text-sm pl-3 pr-8 py-2 rounded-lg border cursor-pointer outline-none"
            style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC", color: "#0F0F0D" }}
          >
            {periods.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#8A8680" }} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        <div className="rounded-xl border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}>
          <div className="mb-2"><TrendingUp size={18} style={{ color: "#1A9E68" }} /></div>
          <p className="text-2xl font-semibold" style={{ color: "#0F0F0D" }}>{tasksDone}</p>
          <p className="text-sm mt-0.5" style={{ color: "#0F0F0D" }}>{t("kpi.tasksCompleted")}</p>
          <p className="text-xs mt-1" style={{ color: "#8A8680" }}>
            {budgetCents > 0
              ? `${summary?.costs.monthUtilizationPercent.toFixed(0)}% ${t("kpi.budgetUsed")}`
              : t("kpi.thisMonth")}
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}>
          <div className="mb-2"><Clock size={18} style={{ color: "#1A4E8C" }} /></div>
          <p className="text-2xl font-semibold" style={{ color: "#0F0F0D" }}>
            {hoursSaved > 0 ? `${hoursSaved} h` : "0 h"}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "#0F0F0D" }}>{t("kpi.hoursSaved")}</p>
          <p className="text-xs mt-1" style={{ color: "#8A8680" }}>{t("kpi.estimatedTime")}</p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}>
          <div className="mb-2"><Euro size={18} style={{ color: "#C97C0A" }} /></div>
          <p className="text-2xl font-semibold" style={{ color: "#0F0F0D" }}>
            {costEuros > 0 ? `≈ ${costEuros} €` : "0,00 €"}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "#0F0F0D" }}>{t("kpi.aiCost")}</p>
          <p className="text-xs mt-1" style={{ color: "#8A8680" }}>{t("kpi.fullTeam")}</p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}>
          <div className="mb-2"><Users size={18} style={{ color: "#8A8680" }} /></div>
          <p className="text-2xl font-semibold" style={{ color: "#0F0F0D" }}>
            {monthlyCostHuman > 0 ? `≈ ${formatNumber(monthlyCostHuman)} €` : "0 €"}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "#0F0F0D" }}>{t("kpi.humanEquivalent")}</p>
          <p className="text-xs mt-1" style={{ color: "#8A8680" }}>{t("kpi.estimatedMonthly")}</p>
        </div>
      </div>

      {/* Hire simulator */}
      <div className="rounded-xl border p-5 mb-6" style={{ backgroundColor: "#1A9E6808", borderColor: "#1A9E6840" }}>
        <h2 className="text-base font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}>
          {t("simulator.title")}
        </h2>
        <div className="w-full mb-4" style={{ height: "1px", backgroundColor: "#1A9E6830" }} />

        <p className="text-sm mb-4" style={{ color: "#0F0F0D" }}>
          {t("simulator.aiTeamDoes")}{" "}
          <span className="font-semibold" style={{ color: "#1A9E68" }}>
            {fteCount.toFixed(1).replace(".", ",")} ETP
          </span>{" "}
          {t("simulator.at")}{" "}
          <span className="font-semibold" style={{ color: "#1A9E68" }}>
            {monthlyCostAI} €/mois
          </span>.
        </p>

        <div className="rounded-lg p-4 mb-4 text-sm space-y-1" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E4DC" }}>
          <p style={{ color: "#0F0F0D" }}>
            {t("simulator.hireCompare")}{" "}
            <span className="font-medium">{formatNumber(Math.round(fteCount * 2800))} €/mois brut</span>
          </p>
          <p style={{ color: "#8A8680" }}>
            + {t("simulator.charges")} :{" "}
            <span className="font-medium" style={{ color: "#0F0F0D" }}>
              {formatNumber(monthlyCostHuman)} €/mois
            </span>
          </p>
          <div className="pt-2 mt-2 border-t font-semibold" style={{ borderColor: "#E8E4DC", color: "#1A9E68" }}>
            {t("simulator.savings")} : {formatNumber(savings)} €/mois
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: "#8A8680" }}>
            {t("simulator.adjustLabel", { count: fteCount.toFixed(1).replace(".", ",") })}
          </label>
          <input
            type="range" min={0.5} max={3} step={0.1}
            value={fteCount}
            onChange={(e) => setFteCount(parseFloat(e.target.value))}
            className="w-full accent-[#1A9E68]"
            style={{ accentColor: "#1A9E68" }}
          />
          <div className="flex justify-between text-xs mt-1" style={{ color: "#8A8680" }}>
            <span>0,5 ETP</span>
            <span>3 ETP</span>
          </div>
        </div>
      </div>

      {/* Activity by agent */}
      {agents.length > 0 && (
        <div className="rounded-xl border p-5 mb-6" style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}>
          <h2 className="text-base font-semibold mb-4" style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}>
            {t("activityByAgent")}
          </h2>
          <div className="space-y-3">
            {agents.map((agent, i) => {
              const color = AGENT_COLORS[i % AGENT_COLORS.length]!;
              const isActive = agent.status === "active";
              return (
                <div key={agent.id} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: isActive ? color : "#8A8680" }}
                  >
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "#0F0F0D" }}>{agent.name}</p>
                  </div>
                  <span className="text-xs" style={{ color: isActive ? color : "#8A8680" }}>
                    {isActive ? tc("agentStatus.active") : tc("agentStatus.paused")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Share CTA */}
      <div className="rounded-xl border p-5 flex items-center justify-between" style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}>
        <div>
          <p className="text-sm font-medium" style={{ color: "#0F0F0D" }}>{t("share.title")}</p>
          <p className="text-xs mt-0.5" style={{ color: "#8A8680" }}>{t("share.subtitle")}</p>
        </div>
        <button
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}
        >
          <Share2 size={14} />
          {t("share.cta")}
        </button>
      </div>
    </div>
  );
}
