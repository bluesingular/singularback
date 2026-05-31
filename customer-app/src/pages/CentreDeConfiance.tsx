import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { trustApi, agentsApi } from "../api/client";
import { ShieldCheck, TrendingUp } from "lucide-react";

const LEVEL_COLOR: Record<string, string> = {
  building: "text-[#A09890] bg-[#F5F2EE]",
  supervised: "text-[#C97C0A] bg-[#FFF8EE]",
  trusted: "text-[#1A4E8C] bg-[#EEF4FF]",
  highly_trusted: "text-[#1A9E68] bg-[#EDFAF4]",
};

const LEVEL_LABEL: Record<string, string> = {
  building: "En apprentissage",
  supervised: "Supervisé",
  trusted: "De confiance",
  highly_trusted: "Hautement fiable",
};

export default function CentreDeConfiance() {
  const { companyId } = useAuth();
  const qc = useQueryClient();

  const { data: trustData } = useQuery({
    queryKey: ["trust-scores", companyId],
    queryFn: () => trustApi.scores(companyId!),
    enabled: !!companyId,
  });

  const { data: proposalsData } = useQuery({
    queryKey: ["trust-proposals", companyId],
    queryFn: () => trustApi.proposals(companyId!),
    enabled: !!companyId,
  });

  const { data: agentsData } = useQuery({
    queryKey: ["agents", companyId],
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const approve = useMutation({
    mutationFn: (id: string) => trustApi.approveProposal(id, companyId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trust-proposals", companyId] });
      qc.invalidateQueries({ queryKey: ["trust-scores", companyId] });
    },
  });

  const reject = useMutation({
    mutationFn: (id: string) => trustApi.rejectProposal(id, companyId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trust-proposals", companyId] }),
  });

  const agents = agentsData ?? [];
  const scores = trustData?.scores ?? [];
  const proposals = proposalsData?.proposals ?? [];

  const agentName = (id: string) =>
    agents.find((a) => a.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="font-serif text-2xl text-[#1A1A1A]">Centre de confiance</h1>

      {/* Pending proposals */}
      {proposals.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Propositions d'autonomie
          </h2>
          <div className="space-y-3">
            {proposals.map((p) => (
              <div key={p.id} className="bg-white border border-[#E8E4DC] rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">
                      {agentName(p.agentId)}
                    </p>
                    <p className="text-xs text-[#6B6B6B] mt-0.5">
                      {LEVEL_LABEL[p.currentLevel] ?? p.currentLevel}
                      {" → "}
                      <span className="font-medium text-[#1A9E68]">
                        {LEVEL_LABEL[p.proposedLevel] ?? p.proposedLevel}
                      </span>
                    </p>
                    <p className="text-xs text-[#6B6B6B] mt-2 italic">{p.evidence}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => reject.mutate(p.id)}
                      className="text-xs border border-[#E8E4DC] px-3 py-1.5 rounded-md hover:bg-[#F5F2EE] transition-colors"
                    >
                      Refuser
                    </button>
                    <button
                      onClick={() => approve.mutate(p.id)}
                      className="text-xs bg-[#1A9E68] hover:bg-[#158a59] text-white px-3 py-1.5 rounded-md transition-colors"
                    >
                      Accorder
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trust score table */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-3 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          Niveaux d'autonomie actuels
        </h2>
        {scores.length === 0 ? (
          <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 text-center">
            <p className="text-sm text-[#6B6B6B]">
              Aucune donnée de confiance disponible. Les scores se construisent au fil des tâches complétées.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#E8E4DC] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4DC] bg-[#F5F2EE]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B6B6B]">Agent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B6B6B]">Compétence</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B6B6B]">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B6B6B]">Niveau</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B6B6B]">Série</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={i} className="border-b border-[#F0EDE8] last:border-0">
                    <td className="px-4 py-3 font-medium text-[#1A1A1A]">{agentName(s.agentId)}</td>
                    <td className="px-4 py-3 text-[#6B6B6B] font-mono text-xs">{s.skillType}</td>
                    <td className="px-4 py-3 text-[#1A1A1A]">{s.score.toFixed(1)} / 5</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_COLOR[s.autonomyLevel] ?? ""}`}>
                        {LEVEL_LABEL[s.autonomyLevel] ?? s.autonomyLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#6B6B6B]">{s.approvalStreak} ✓</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
