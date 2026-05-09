import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { intelligenceApi, agentsApi, costsApi, approvalsApi } from "../api/client";
import { AlertTriangle, Zap, TrendingUp, CheckCircle, Clock, Users } from "lucide-react";

const URGENCY_COLOR = {
  high: "border-l-[#C97C0A] bg-[#FFF8EE]",
  medium: "border-l-[#1A4E8C] bg-[#EEF4FF]",
  low: "border-l-[#E8E4DC] bg-white",
};

const URGENCY_ICON = {
  high: <AlertTriangle className="w-4 h-4 text-[#C97C0A]" />,
  medium: <TrendingUp className="w-4 h-4 text-[#1A4E8C]" />,
  low: <Zap className="w-4 h-4 text-[#6B6B6B]" />,
};

export default function TableauDeBord() {
  const { companyId } = useAuth();
  const qc = useQueryClient();

  const { data: intel } = useQuery({
    queryKey: ["intelligence", companyId],
    queryFn: () => intelligenceApi.cards(companyId!),
    enabled: !!companyId,
  });

  const { data: agentsData } = useQuery({
    queryKey: ["agents", companyId],
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: costs } = useQuery({
    queryKey: ["costs", companyId],
    queryFn: () => costsApi.summary(companyId!),
    enabled: !!companyId,
  });

  const { data: approvalsData } = useQuery({
    queryKey: ["approvals", companyId],
    queryFn: () => approvalsApi.pending(companyId!),
    enabled: !!companyId,
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => intelligenceApi.dismiss(id, companyId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intelligence", companyId] }),
  });

  const approveTask = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id, companyId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals", companyId] }),
  });

  const cards = intel?.cards ?? [];
  const agents = agentsData?.agents ?? [];
  const approvals = approvalsData?.approvals ?? [];
  const usagePercent = costs
    ? Math.min(100, Math.round((costs.tasksThisMonth / Math.max(costs.tasksLimit, 1)) * 100))
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="font-serif text-2xl text-[#1A1A1A]">Tableau de bord</h1>

      {/* Intelligence cards */}
      {cards.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-3">
            Insights du matin
          </h2>
          <div className="space-y-3">
            {cards.slice(0, 3).map((card) => (
              <div
                key={card.id}
                className={`border-l-4 rounded-r-lg px-4 py-3 flex items-start justify-between gap-4 ${URGENCY_COLOR[card.urgency]}`}
              >
                <div className="flex items-start gap-3">
                  {URGENCY_ICON[card.urgency]}
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">{card.title}</p>
                    <p className="text-xs text-[#6B6B6B] mt-0.5">{card.body}</p>
                  </div>
                </div>
                <button
                  onClick={() => dismiss.mutate(card.id)}
                  className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] shrink-0"
                >
                  Ignorer
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending approvals */}
      {approvals.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-3">
            En attente d'approbation
          </h2>
          <div className="space-y-2">
            {approvals.slice(0, 5).map((a) => (
              <div key={a.id} className="bg-white border border-[#E8E4DC] rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#1A1A1A]">{a.taskTitle}</p>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">{a.agentName} · {a.description}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approveTask.mutate(a.id)}
                    className="text-xs bg-[#1A9E68] hover:bg-[#158a59] text-white px-3 py-1.5 rounded-md transition-colors"
                  >
                    Approuver
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team status */}
        <section className="bg-white border border-[#E8E4DC] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-[#6B6B6B]" />
            <h2 className="text-sm font-semibold text-[#1A1A1A]">Mon équipe</h2>
          </div>
          {agents.length === 0 ? (
            <p className="text-sm text-[#6B6B6B]">Aucun agent configuré.</p>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      agent.status === "active" ? "bg-[#1A9E68]" : "bg-[#D1C9BC]"
                    }`} />
                    <span className="text-sm text-[#1A1A1A]">{agent.name}</span>
                  </div>
                  <span className="text-xs text-[#6B6B6B]">{agent.adapterType ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Usage gauge */}
        <section className="bg-white border border-[#E8E4DC] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-[#6B6B6B]" />
            <h2 className="text-sm font-semibold text-[#1A1A1A]">Utilisation</h2>
          </div>
          {costs ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-[#6B6B6B] mb-1.5">
                  <span>{costs.translation ?? `${costs.tasksThisMonth} tâches`}</span>
                  <span>{usagePercent}%</span>
                </div>
                <div className="h-2 bg-[#F0EDE8] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usagePercent > 80 ? "bg-[#C97C0A]" : "bg-[#1A9E68]"
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-[#6B6B6B] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {costs.tasksLimit - costs.tasksThisMonth} tâches restantes ce mois
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#6B6B6B]">Chargement…</p>
          )}
        </section>
      </div>
    </div>
  );
}
