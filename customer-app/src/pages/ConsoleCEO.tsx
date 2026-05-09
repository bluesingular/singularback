import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { intelligenceApi, approvalsApi, trustApi } from "../api/client";
import { Terminal, AlertTriangle, TrendingUp, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function ConsoleCEO() {
  const { companyId } = useAuth();

  const { data: intel } = useQuery({
    queryKey: ["intelligence", companyId],
    queryFn: () => intelligenceApi.cards(companyId!),
    enabled: !!companyId,
  });

  const { data: approvalsData } = useQuery({
    queryKey: ["approvals", companyId],
    queryFn: () => approvalsApi.pending(companyId!),
    enabled: !!companyId,
  });

  const { data: proposalsData } = useQuery({
    queryKey: ["trust-proposals", companyId],
    queryFn: () => trustApi.proposals(companyId!),
    enabled: !!companyId,
  });

  const cards = intel?.cards ?? [];
  const approvals = approvalsData?.approvals ?? [];
  const proposals = proposalsData?.proposals ?? [];

  const totalActions = approvals.length + proposals.length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Terminal className="w-5 h-5 text-[#1A9E68]" />
        <h1 className="font-serif text-2xl text-[#1A1A1A]">Console CEO</h1>
      </div>

      {totalActions === 0 && cards.length === 0 ? (
        <div className="bg-white border border-[#E8E4DC] rounded-xl p-10 text-center">
          <CheckCircle className="w-8 h-8 text-[#1A9E68] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1A1A1A]">Votre équipe est opérationnelle</p>
          <p className="text-xs text-[#6B6B6B] mt-1">Aucune action requise de votre part pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Intelligence cards */}
          {cards.length > 0 && (
            <div className="bg-white border border-[#E8E4DC] rounded-xl divide-y divide-[#F0EDE8]">
              <div className="px-4 py-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#C97C0A]" />
                <span className="text-sm font-semibold text-[#1A1A1A]">Insights</span>
                <span className="ml-auto text-xs text-[#6B6B6B]">{cards.length}</span>
              </div>
              {cards.map((card) => (
                <div key={card.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-[#1A1A1A]">{card.title}</p>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">{card.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* Pending approvals */}
          {approvals.length > 0 && (
            <div className="bg-white border border-[#E8E4DC] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#C97C0A]" />
                <span className="text-sm text-[#1A1A1A]">
                  <span className="font-semibold">{approvals.length}</span> action{approvals.length > 1 ? "s" : ""} en attente
                </span>
              </div>
              <Link
                to="/approbations"
                className="text-xs bg-[#1A9E68] hover:bg-[#158a59] text-white px-3 py-1.5 rounded-md transition-colors"
              >
                Traiter
              </Link>
            </div>
          )}

          {/* Trust proposals */}
          {proposals.length > 0 && (
            <div className="bg-white border border-[#E8E4DC] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#1A4E8C]" />
                <span className="text-sm text-[#1A1A1A]">
                  <span className="font-semibold">{proposals.length}</span> proposition{proposals.length > 1 ? "s" : ""} d'autonomie
                </span>
              </div>
              <Link
                to="/centre-de-confiance"
                className="text-xs border border-[#E8E4DC] px-3 py-1.5 rounded-md hover:bg-[#F5F2EE] transition-colors"
              >
                Examiner
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
