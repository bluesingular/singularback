/**
 * ui/src/components/ClarificationCard.tsx
 *
 * G5 — Shown in TaskThread when issue.status === "awaiting_clarification".
 * Operator reads the agent's question, types an answer, and submits.
 * On submit the backend cancels the timeout, sets issue → in_progress,
 * and triggers an agent heartbeat.
 */

import * as React from "react";
import { MessageCircleQuestion, Send, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clarificationsApi, type ClarificationRequest } from "@/api/clarifications";

interface ClarificationCardProps {
  clarification: ClarificationRequest;
  companyId:     string;
  /** Called after a successful reply so the parent can update its state */
  onAnswered?:   () => void;
}

export function ClarificationCard({ clarification, companyId, onAnswered }: ClarificationCardProps) {
  const [answer, setAnswer]   = React.useState("");
  const queryClient           = useQueryClient();

  const replyMutation = useMutation({
    mutationFn: () => clarificationsApi.reply(companyId, clarification.id, answer.trim()),
    onSuccess: () => {
      setAnswer("");
      // Invalidate the issue query so TaskThread re-fetches the updated status
      queryClient.invalidateQueries({ queryKey: ["issue"] });
      onAnswered?.();
    },
  });

  const canSubmit = answer.trim().length > 0 && !replyMutation.isPending;

  return (
    <div className="rounded-2xl border border-[#C97C0A]/30 bg-[#FFF8EC] p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircleQuestion size={16} className="text-[#C97C0A] flex-shrink-0" />
        <p className="text-xs font-semibold text-[#C97C0A] uppercase tracking-wide">
          Question de l'agent
        </p>
      </div>

      {/* Question */}
      <p className="text-sm text-[#0F0F0D] leading-relaxed">
        {clarification.question}
      </p>

      {/* Answer textarea */}
      <textarea
        className="w-full rounded-xl border border-[#E8E4DC] bg-white px-3 py-2.5 text-sm text-[#0F0F0D] placeholder-[#8A8680] resize-none focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30 focus:border-[#1A9E68]"
        rows={3}
        placeholder="Votre réponse..."
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
            replyMutation.mutate();
          }
        }}
        disabled={replyMutation.isPending}
      />

      {/* Error */}
      {replyMutation.isError && (
        <p className="text-xs text-red-600">
          {(replyMutation.error as Error).message}
        </p>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#8A8680]">⌘ Enter pour envoyer</p>
        <button
          onClick={() => replyMutation.mutate()}
          disabled={!canSubmit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1A9E68] text-white hover:bg-[#158a5b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {replyMutation.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Send size={12} />
          )}
          Envoyer
        </button>
      </div>
    </div>
  );
}
