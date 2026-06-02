/**
 * WAR-11 — Gap F retrain modal — two-tab: soul + skills.
 *
 * "Soul" tab: edit the agent's identity layer (tone, constraints, persona).
 *   Writes soul.md via PATCH /agents/:id
 *
 * "Skills" tab: read-only summary of agent capabilities with version info.
 *   Skill content is authored in Skill Manager (admin portal) — tenant sees
 *   the current version and the trust score that drives autonomy.
 *
 * Opened from the DrillDown panel by clicking "Configurer Sophie →".
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { agentTrainApi, type Agent } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface Props {
  agent: Agent;
  onClose: () => void;
}

const SOUL_PLACEHOLDER = `Ton identité en quelques lignes.
Exemple :
- Tu es directe, précise, professionnelle.
- Tu ne fais jamais de promesses que la plateforme ne peut pas tenir.
- En cas de doute, tu demandes une clarification avant d'agir.`;

export function RetrainModal({ agent, onClose }: Props) {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"soul" | "skills">("soul");
  const [soulText, setSoulText] = useState<string>((agent as any).soulMd ?? "");
  const [saved, setSaved] = useState(false);

  const saveSOul = useMutation({
    mutationFn: () => agentTrainApi.updateSoul(companyId!, agent.id, soulText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", companyId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const agentColour = (agent as any).colour ?? "#3B82F6";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E8E4DC]">
          <span
            className="w-8 h-8 rounded-full flex-shrink-0"
            style={{ backgroundColor: agentColour }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1A1A1A] truncate">{agent.name}</p>
            <p className="text-xs text-[#6B6B6B]">Configuration</p>
          </div>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#1A1A1A]">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E8E4DC]">
          {(["soul", "skills"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === t
                  ? "text-[#1A1A1A] border-b-2 border-[#1A1A1A]"
                  : "text-[#6B6B6B] hover:text-[#1A1A1A]"
              }`}
            >
              {t === "soul" ? "Identité" : "Compétences"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "soul" ? (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-[#6B6B6B]">
                Définissez le ton, les contraintes et la personnalité de {agent.name}.
                Ces instructions guident chaque tâche.
              </p>
              <textarea
                value={soulText}
                onChange={(e) => setSoulText(e.target.value)}
                rows={12}
                placeholder={SOUL_PLACEHOLDER}
                className="w-full resize-none text-sm rounded-lg border border-[#E8E4DC] px-3 py-2.5 focus:outline-none focus:border-[#1A9E68] bg-[#FAFAF8] placeholder:text-[#C4BFB8] font-mono"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-[#6B6B6B]">
                Les compétences de {agent.name} sont gérées par votre pack.
                Elles évoluent automatiquement à mesure que {agent.name} apprend.
              </p>
              <div className="rounded-xl border border-[#E8E4DC] divide-y divide-[#E8E4DC]">
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-[#3A3A3A]">Rôle</span>
                  <span className="text-sm font-medium text-[#1A1A1A] capitalize">
                    {(agent as any).role ?? agent.name}
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-[#3A3A3A]">Niveau de confiance</span>
                  <span className="text-sm font-medium text-[#1A9E68]">
                    {formatAutonomy((agent as any).autonomyLevel)}
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-[#3A3A3A]">Tâches réalisées</span>
                  <span className="text-sm font-medium text-[#1A1A1A]">
                    {(agent as any).taskCount ?? "—"}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#6B6B6B] bg-[#F4F9F6] rounded-lg px-3 py-2.5">
                {agent.name} améliore ses compétences à chaque tâche approuvée.
                Aucune action requise de votre part.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === "soul" && (
          <div className="px-6 py-4 border-t border-[#E8E4DC] flex items-center justify-between">
            <p className="text-xs text-[#6B6B6B]">
              {saved ? `Identité de ${agent.name} mise à jour.` : ""}
            </p>
            <button
              onClick={() => saveSOul.mutate()}
              disabled={saveSOul.isPending}
              className="rounded-lg bg-[#1A1A1A] text-white px-4 py-2 text-sm font-medium hover:bg-[#333] disabled:opacity-50 transition-colors"
            >
              {saveSOul.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatAutonomy(level: string | undefined): string {
  const map: Record<string, string> = {
    manual:       "Manuel",
    supervised:   "Supervisé",
    spot_checked: "Contrôle ponctuel",
    autonomous:   "Autonome",
  };
  return map[level ?? ""] ?? "—";
}
