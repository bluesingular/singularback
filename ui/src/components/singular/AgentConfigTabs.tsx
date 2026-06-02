/**
 * ui/src/components/singular/AgentConfigTabs.tsx
 *
 * WAR-11: Two-tab agent configuration — Soul tab + Skills tab.
 *
 * Soul tab:  edit soul.md (identity, tone, constraints, constitution)
 * Skills tab: existing config_params from ConfigAgent
 *
 * SOUL vs SKILL separation (CLAUDE.md):
 *   soul.md  = WHO the agent is (tone, forbidden words, constraints)
 *   skill.md = WHAT the agent can do (capabilities, schemas, thresholds)
 *   These write to different backend paths.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, CheckCircle, User, Wrench } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { cn } from "../../lib/utils";

// ── Soul API (writes to agents.soul_md) ────────────────────────────────────────

async function fetchSoulMd(companyId: string, agentId: string): Promise<string> {
  const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/soul`, {
    credentials: "include",
  });
  if (!res.ok) return "";
  const data = await res.json() as { soulMd?: string };
  return data.soulMd ?? "";
}

async function saveSoulMd(companyId: string, agentId: string, soulMd: string): Promise<void> {
  const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/soul`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soulMd }),
  });
  if (!res.ok) throw new Error("Failed to save agent identity.");
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = "soul" | "skills";

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex border-b border-stone-200">
      {([
        { id: "soul",   label: "Identity",     icon: User },
        { id: "skills", label: "Skills",  icon: Wrench },
      ] as const).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
            active === id
              ? "border-[#1A9E68] text-[#1A9E68]"
              : "border-transparent text-stone-500 hover:text-stone-700",
          )}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Soul tab ──────────────────────────────────────────────────────────────────

function SoulTab({ agentId, agentName }: { agentId: string; agentName: string }) {
  const { selectedCompanyId } = useCompany();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const { data: soulMd = "" } = useQuery({
    queryKey: ["agent-soul", selectedCompanyId, agentId],
    queryFn: () => fetchSoulMd(selectedCompanyId!, agentId),
    enabled: !!selectedCompanyId && !!agentId,
  });

  const value = draft ?? soulMd;

  const mutation = useMutation({
    mutationFn: () => saveSoulMd(selectedCompanyId!, agentId, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-soul", selectedCompanyId, agentId] });
      setSaved(true);
      setDraft(null);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-stone-700">soul.md — Identité de {agentName}</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Définit le ton, les contraintes et la constitution de l'agent. Distinct des compétences.
          </p>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || saved || draft === null}
          className={cn(
            "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors",
            saved
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : draft === null
              ? "bg-stone-100 text-stone-400 cursor-not-allowed"
              : "bg-[#1A9E68] text-white hover:bg-[#158A58]",
          )}
        >
          {saved ? <><CheckCircle size={13} /> Enregistré</> : <><Save size={13} /> Enregistrer</>}
        </button>
      </div>

      <textarea
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        rows={16}
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30 resize-none"
        placeholder="# Identité de l'agent&#10;&#10;Tu es Sophie, chargée de sourcing..."
      />

      <p className="text-xs text-stone-400">
        Le bloc <code className="bg-stone-100 px-1 rounded">[[CONSTITUTION]]</code> est
        automatiquement injecté si absent. Les modifications s'appliquent à la prochaine tâche.
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AgentConfigTabs({
  agentId,
  agentName,
  skillsContent,
}: {
  agentId:      string;
  agentName:    string;
  skillsContent: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("soul");

  return (
    <div className="flex flex-col gap-0">
      <TabBar active={tab} onChange={setTab} />
      <div className="p-5">
        {tab === "soul" ? (
          <SoulTab agentId={agentId} agentName={agentName} />
        ) : (
          skillsContent
        )}
      </div>
    </div>
  );
}
