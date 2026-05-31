/**
 * ui/src/components/singular/SessionGapBriefing.tsx
 *
 * Gap K — Session gap awareness overlay.
 *
 * Shows when operator opens app after ≥6h absence.
 * One screen max — "Voir le tableau de bord →" dismisses to normal console.
 * NOT the same as morning intelligence (daily). Fires any time of day after absence.
 */

import { useQuery } from "@tanstack/react-query";
import { Clock, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { useNavigate } from "@/lib/router";

interface GapBriefing {
  gapHours:       number;
  tasksCompleted: number;
  tasksPending:   number;
  notableEvents:  string[];
}

async function fetchGapBriefing(companyId: string): Promise<GapBriefing> {
  const res = await fetch(`/api/companies/${companyId}/session-gap-briefing`, {
    credentials: "include",
  });
  if (!res.ok) return { gapHours: 0, tasksCompleted: 0, tasksPending: 0, notableEvents: [] };
  return res.json() as Promise<GapBriefing>;
}

export function SessionGapBriefing({ onDismiss }: { onDismiss: () => void }) {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["session-gap", selectedCompanyId],
    queryFn:  () => fetchGapBriefing(selectedCompanyId!),
    enabled:  !!selectedCompanyId,
    staleTime: Infinity, // only fetch once per session
  });

  // Don't show if gap is small
  if (!data || data.gapHours < 6) return null;

  const hours = data.gapHours;
  const label = hours >= 24
    ? `${Math.round(hours / 24)} jour${Math.round(hours / 24) > 1 ? "s" : ""}`
    : `${hours} heure${hours > 1 ? "s" : ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1A4E8C]/10 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-[#1A4E8C]" />
          </div>
          <div>
            <p className="font-semibold text-[#0F0F0D]">Bienvenue de retour</p>
            <p className="text-sm text-stone-500">Absent depuis {label}</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">Terminées</span>
            </div>
            <p className="text-2xl font-semibold text-emerald-700">{data.tasksCompleted}</p>
            <p className="text-xs text-emerald-600">tâche{data.tasksCompleted !== 1 ? "s" : ""}</p>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertCircle size={13} className="text-amber-600" />
              <span className="text-xs font-medium text-amber-700">Votre attention</span>
            </div>
            <p className="text-2xl font-semibold text-amber-700">{data.tasksPending}</p>
            <p className="text-xs text-amber-600">en attente</p>
          </div>
        </div>

        {/* Notable events */}
        {data.notableEvents.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Événements notables</p>
            {data.notableEvents.map((event, i) => (
              <div key={i} className="text-sm text-stone-700 flex items-start gap-2">
                <span className="mt-1 w-1 h-1 rounded-full bg-[#1A4E8C] flex-shrink-0" />
                {event}
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => {
            onDismiss();
            navigate("tableau-de-bord");
          }}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#1A9E68] text-white font-medium text-sm hover:bg-[#158A58] transition-colors"
        >
          Voir le tableau de bord
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
