/**
 * ui/src/pages/singular/MissionsArchive.tsx
 *
 * WAR-12: Mission archive — lists completed and archived missions.
 * Accessible from CEO Console via "Voir les missions passées →".
 */

import { useQuery } from "@tanstack/react-query";
import { Archive, CheckCircle2, Clock } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { useLocale } from "../../hooks/useLocale";

interface Mission {
  id:          string;
  title:       string;
  brief:       string;
  status:      string;
  createdAt:   string;
  completedAt: string | null;
}

async function fetchArchivedMissions(companyId: string): Promise<Mission[]> {
  const res = await fetch(`/api/companies/${companyId}/missions?status=archived,complete`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const all = (await res.json()) as Mission[];
  return all.filter((m) => m.status === "archived" || m.status === "complete");
}

function StatusChip({ status }: { status: string }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 size={10} />
        Terminée
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
      <Archive size={10} />
      Archived
    </span>
  );
}

export function MissionsArchive() {
  const { selectedCompanyId } = useCompany();
  const { formatDate } = useLocale();

  const { data: missions = [], isLoading } = useQuery({
    queryKey: ["missions-archive", selectedCompanyId],
    queryFn:  () => fetchArchivedMissions(selectedCompanyId!),
    enabled:  !!selectedCompanyId,
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">Missions passées</h1>
          <p className="text-sm text-stone-500 mt-1">
            Missions terminées et archivées — l'historique de votre équipe.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-16">
            <Archive size={32} className="mx-auto text-stone-300 mb-3" />
            <p className="text-stone-500 text-sm">No archived missions.pour le moment.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {missions.map((mission) => (
              <div
                key={mission.id}
                className="rounded-xl border border-stone-200 bg-white p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-stone-900 text-sm leading-snug">{mission.title}</p>
                  <StatusChip status={mission.status} />
                </div>

                {mission.brief && (
                  <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">
                    {mission.brief}
                  </p>
                )}

                <div className="flex items-center gap-1 text-xs text-stone-400 mt-1">
                  <Clock size={11} />
                  <span>
                    {mission.completedAt
                      ? `Completed on ${formatDate(new Date(mission.completedAt))}`
                      : `Créée le ${formatDate(new Date(mission.createdAt))}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
