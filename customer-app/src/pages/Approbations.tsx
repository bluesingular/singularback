import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { approvalsApi } from "../api/client";
import { CheckCircle, XCircle, Clock } from "lucide-react";

export default function Approbations() {
  const { companyId } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["approvals", companyId],
    queryFn: () => approvalsApi.pending(companyId!),
    enabled: !!companyId,
    refetchInterval: 15_000,
  });

  const approve = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id, companyId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals", companyId] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id, companyId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals", companyId] }),
  });

  const approvals = data?.approvals ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-[#1A1A1A]">Approbations</h1>
        {approvals.length > 0 && (
          <span className="text-xs bg-[#C97C0A]/10 text-[#C97C0A] font-medium px-2.5 py-1 rounded-full">
            {approvals.length} en attente
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-[#6B6B6B]">Chargement…</div>
      ) : approvals.length === 0 ? (
        <div className="bg-white border border-[#E8E4DC] rounded-xl p-10 text-center">
          <CheckCircle className="w-8 h-8 text-[#1A9E68] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1A1A1A]">Tout est à jour</p>
          <p className="text-xs text-[#6B6B6B] mt-1">Aucune action en attente de votre validation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <div key={a.id} className="bg-white border border-[#E8E4DC] rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1A1A1A] truncate">{a.taskTitle}</p>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">
                    <span className="font-medium">{a.agentName}</span> · {a.description}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-[#A09890]">
                    <Clock className="w-3 h-3" />
                    {new Date(a.createdAt).toLocaleString("fr-FR", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                    })}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => reject.mutate(a.id)}
                    disabled={reject.isPending}
                    className="flex items-center gap-1.5 text-xs border border-[#E8E4DC] px-3 py-1.5 rounded-md hover:bg-[#F5F2EE] transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    Refuser
                  </button>
                  <button
                    onClick={() => approve.mutate(a.id)}
                    disabled={approve.isPending}
                    className="flex items-center gap-1.5 text-xs bg-[#1A9E68] hover:bg-[#158a59] text-white px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approuver
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
