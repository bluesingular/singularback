/**
 * ui/src/components/InlineOutputEditor.tsx
 *
 * Gap B — Inline output editing before approval.
 *
 * Operator edits the agent's output directly in the task approval card
 * before approving. The corrected version is the highest-signal training
 * data (weight 3.0 in golden_datasets).
 *
 * INVARIANT: Only creates a training example when content was CHANGED.
 * Approving as-is produces no training signal — this is enforced server-side.
 *
 * UI spec:
 *   - Plain textarea only (no markdown preview, no formatting toolbar)
 *   - "Modifier avant approbation" trigger link
 *   - "Vous avez modifié N caractères — Sophie apprend." after save
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Edit3, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

interface Props {
  /** Task ID — used for the new inline-edit endpoint */
  taskId:         string;
  companyId:      string;
  originalOutput: string;
  onEditSaved?:   (edited: string) => void;
}

async function patchTaskEdit(
  companyId: string,
  taskId: string,
  operatorEdit: string,
  originalOutput: string,
): Promise<{ ok: boolean; recorded: boolean; charCount: number }> {
  const res = await fetch(
    `/api/companies/${companyId}/tasks/${taskId}/inline-edit`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operatorEdit, originalOutput }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Impossible d'enregistrer la modification.");
  }
  return res.json();
}

export function InlineOutputEditor({
  taskId,
  companyId,
  originalOutput,
  onEditSaved,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(originalOutput);
  const [saved,   setSaved]   = useState<{ charCount: number } | null>(null);

  const mutation = useMutation({
    mutationFn: () => patchTaskEdit(companyId, taskId, draft, originalOutput),
    onSuccess: (data) => {
      if (data.recorded) {
        setSaved({ charCount: data.charCount });
        onEditSaved?.(draft);
      } else {
        // No change detected — close editor silently
        setEditing(false);
      }
    },
  });

  // After save: show confirmation
  if (saved) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[#1A9E68] mt-2">
        <CheckCircle2 size={12} />
        <span>
          Vous avez modifié {saved.charCount} caractère
          {saved.charCount !== 1 ? "s" : ""} — Sophie apprend.
        </span>
      </div>
    );
  }

  // Collapsed: show "Modifier avant approbation" link
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

  // Expanded: plain textarea (no markdown, no toolbar per spec)
  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30 resize-y"
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
        <p className="text-xs text-red-500">
          {(mutation.error as Error).message}
        </p>
      )}
    </div>
  );
}
