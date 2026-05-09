import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { costsApi, agentsApi } from "../api/client";
import { BarChart2 } from "lucide-react";

export default function Rapports() {
  const { companyId } = useAuth();

  const { data: costs } = useQuery({
    queryKey: ["costs", companyId],
    queryFn: () => costsApi.summary(companyId!),
    enabled: !!companyId,
  });

  const { data: agentsData } = useQuery({
    queryKey: ["agents", companyId],
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const agents = agentsData?.agents ?? [];
  const usagePercent = costs
    ? Math.min(100, Math.round((costs.tasksThisMonth / Math.max(costs.tasksLimit, 1)) * 100))
    : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-5 h-5 text-[#1A9E68]" />
        <h1 className="font-serif text-2xl text-[#1A1A1A]">Rapports</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E8E4DC] rounded-xl p-4">
          <p className="text-xs text-[#6B6B6B] mb-1">Tâches ce mois</p>
          <p className="text-3xl font-semibold text-[#1A1A1A]">{costs?.tasksThisMonth ?? "—"}</p>
          {costs?.translation && (
            <p className="text-xs text-[#1A9E68] mt-1">{costs.translation}</p>
          )}
        </div>
        <div className="bg-white border border-[#E8E4DC] rounded-xl p-4">
          <p className="text-xs text-[#6B6B6B] mb-1">Quota utilisé</p>
          <p className="text-3xl font-semibold text-[#1A1A1A]">{usagePercent}%</p>
          <div className="h-1.5 bg-[#F0EDE8] rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full ${usagePercent > 80 ? "bg-[#C97C0A]" : "bg-[#1A9E68]"}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
        <div className="bg-white border border-[#E8E4DC] rounded-xl p-4">
          <p className="text-xs text-[#6B6B6B] mb-1">Agents actifs</p>
          <p className="text-3xl font-semibold text-[#1A1A1A]">{agents.length}</p>
        </div>
      </div>

      <div className="bg-white border border-[#E8E4DC] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Simulateur de valeur</h2>
        <p className="text-sm text-[#6B6B6B]">
          {costs?.tasksThisMonth
            ? `Votre équipe IA a traité ${costs.tasksThisMonth} tâches ce mois — l'équivalent de ${Math.round(costs.tasksThisMonth * 0.25)} heures de travail manuel économisées.`
            : "Les données de valeur s'afficheront dès que votre équipe commence à traiter des tâches."}
        </p>
      </div>
    </div>
  );
}
