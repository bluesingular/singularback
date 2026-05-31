/**
 * ui/src/components/InlineOutputEditor.tsx
 *
 * Gap B — Inline output editing before approval.
 *
 * Operator edits agent output directly in the approval card → approves edited version.
 * The diff is the highest-signal training data per interaction.
 *
 * INVARIANT: Only creates a training example when operator CHANGED content.
 * Approving as-is produces no training signal.
 *
 * UI: plain textarea only — no markdown preview, no formatting tools (spec).
 * Shows "Sophie a révisé X caractères — Sophie apprend." after approval with edit.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Edit3, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

interface Props {
  approvalId:     string;
  originalOutput: string;
  onEditSaved?:   (edited: string) => void;
}

async function patchEdit(approvalId: string, operatorEdit: string, originalOutput: string) {
  const res = await fetch(`/api/approvals/${approvalId}/edit`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operatorEdit, originalOutput }),
  });
  if (!res.ok) throw new Error("Impossible d'enregistrer la modification.");
  return res.json() as Promise<{ ok: boolean; recorded: boolean; charCount: number }>;
}

export function InlineOutputEditor({ approvalId, originalOutput, onEditSaved }: Props) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(originalOutput);
  const [saved, setSaved]       = useState<{ charCount: number } | null>(null);

  const mutation = useMutation({
    mutationFn: () => patchEdit(approvalId, draft, originalOutput),
    onSuccess: (data) => {
      if (data.recorded) {
        setSaved({ charCount: data.charCount });
        onEditSaved?.(draft);
      }
      setEditing(false);
    },
  });

  if (saved) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[#1A9E68] mt-2">
        <CheckCircle2 size={12} />
        <span>Vous avez modifié {saved.charCount} caractère{saved.charCount !== 1 ? "s" : ""} — Sophie apprend.</span>
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors mt-2"
      >
        <Edit3 size={11} />
        Modifier avant approbation
      </button>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30 resize-y font-mono"
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || draft === originalOutput}
          className={cn(
            "text-xs px-3 py-1.5 rounded-lg transition-colors",
            draft !== originalOutput
              ? "bg-[#1A9E68] text-white hover:bg-[#158A58]"
              : "bg-stone-100 text-stone-400 cursor-not-allowed",
          )}
        >
          {mutation.isPending ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        <button
          onClick={() => { setDraft(originalOutput); setEditing(false); }}
          className="text-xs text-stone-400 hover:text-stone-600"
        >
          Annuler
        </button>
      </div>
      {mutation.isError && (
        <p className="text-xs text-red-500">{(mutation.error as Error).message}</p>
      )}
    </div>
  );
}
