/**
 * Gap K — Session gap awareness overlay.
 *
 * Shows one-screen briefing when operator opens the app after ≥6h absence.
 * Fires any time of day (distinct from morning intelligence which fires daily at 8am).
 * Dismissed with "Voir le tableau de bord →" or clicking outside.
 */

import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { sessionApi, type SessionGapBriefing } from "../api/client";

export function SessionGapOverlay() {
  const { companyId } = useAuth();
  const [briefing, setBriefing] = useState<SessionGapBriefing | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    sessionApi.gap(companyId).then((data) => {
      if (data.gapHours > 0) {
        setBriefing(data);
        setVisible(true);
      }
    }).catch(() => {});
  }, [companyId]);

  if (!visible || !briefing) return null;

  const dismiss = () => setVisible(false);

  const hours = briefing.gapHours;
  const absenceLabel = hours >= 24
    ? `${Math.round(hours / 24)} jour${Math.round(hours / 24) > 1 ? "s" : ""}`
    : `${hours}h`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-8 flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide mb-1">
            Pendant votre absence · {absenceLabel}
          </p>
          <h2 className="text-xl font-semibold text-[#1A1A1A]">
            Voici ce qui s'est passé
          </h2>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <div className="flex-1 rounded-xl bg-[#F4F9F6] p-4">
            <p className="text-2xl font-bold text-[#1A9E68]">{briefing.tasksCompleted}</p>
            <p className="text-sm text-[#6B6B6B] mt-0.5">
              {briefing.tasksCompleted === 1 ? "tâche terminée" : "tâches terminées"}
            </p>
          </div>
          {briefing.tasksPending > 0 && (
            <div className="flex-1 rounded-xl bg-[#FFF7ED] p-4">
              <p className="text-2xl font-bold text-[#D97706]">{briefing.tasksPending}</p>
              <p className="text-sm text-[#6B6B6B] mt-0.5">
                {briefing.tasksPending === 1 ? "action requise" : "actions requises"}
              </p>
            </div>
          )}
        </div>

        {/* Notable events */}
        {briefing.notableEvents.length > 0 && (
          <ul className="flex flex-col gap-2">
            {briefing.notableEvents.map((event, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#3A3A3A]">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#1A9E68] flex-shrink-0" />
                {event}
              </li>
            ))}
          </ul>
        )}

        {/* CTA */}
        <button
          onClick={dismiss}
          className="w-full rounded-xl bg-[#1A1A1A] text-white py-3 text-sm font-medium hover:bg-[#333] transition-colors"
        >
          Voir le tableau de bord →
        </button>
      </div>
    </div>
  );
}
