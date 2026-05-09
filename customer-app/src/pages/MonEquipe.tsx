import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { agentsApi, trustApi } from "../api/client";
import { ChevronRight } from "lucide-react";

const TRUST_DOT: Record<string, string> = {
  building: "bg-[#D1C9BC]",
  supervised: "bg-[#C97C0A]",
  trusted: "bg-[#1A4E8C]",
  highly_trusted: "bg-[#1A9E68]",
};

const TRUST_LABEL: Record<string, string> = {
  building: "En apprentissage",
  supervised: "Supervisé",
  trusted: "De confiance",
  highly_trusted: "Hautement fiable",
};

export default function MonEquipe() {
  const { companyId } = useAuth();

  const { data: agentsData } = useQuery({
    queryKey: ["agents", companyId],
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: trustData } = useQuery({
    queryKey: ["trust-scores", companyId],
    queryFn: () => trustApi.scores(companyId!),
    enabled: !!companyId,
  });

  const agents = agentsData?.agents ?? [];
  const scores = trustData?.scores ?? [];

  const trustForAgent = (agentId: string) =>
    scores.filter((s) => s.agentId === agentId);

  const bestLevel = (agentId: string) => {
    const ss = trustForAgent(agentId);
    if (!ss.length) return "building";
    const best = ss.reduce((a, b) => (a.score >= b.score ? a : b));
    return best.autonomyLevel ?? "building";
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="font-serif text-2xl text-[#1A1A1A] mb-6">Mon équipe</h1>

      {agents.length === 0 ? (
        <div className="bg-white border border-[#E8E4DC] rounded-xl p-8 text-center">
          <p className="text-[#6B6B6B] text-sm">
            Aucun agent configuré. Créez votre premier agent dans l'interface d'administration.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const level = bestLevel(agent.id);
            return (
              <Link
                key={agent.id}
                to={`/agent/${agent.id}`}
                className="bg-white border border-[#E8E4DC] rounded-xl p-4 hover:border-[#1A9E68]/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${TRUST_DOT[level] ?? "bg-[#D1C9BC]"}`} />
                    <span className="font-medium text-[#1A1A1A] text-sm">{agent.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#D1C9BC] group-hover:text-[#1A9E68] transition-colors" />
                </div>
                {agent.description && (
                  <p className="text-xs text-[#6B6B6B] mb-3 line-clamp-2">{agent.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B6B6B]">{TRUST_LABEL[level] ?? level}</span>
                  <span className="text-xs text-[#A09890]">{agent.adapterType ?? "—"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
