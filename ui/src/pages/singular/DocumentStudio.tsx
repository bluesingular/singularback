/**
 * ui/src/pages/singular/DocumentStudio.tsx
 *
 * §17 — Proposal and Document Studio.
 *
 * CEO writes a 5-minute brief → picks document type → platform generates
 * a branded document via T3 → task pending approval created.
 *
 * Two states: form | result
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, ChevronRight, CheckCircle2, AlertTriangle, RotateCcw, ArrowRight } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { documentStudioApi, type DocumentType, type DocumentTypeInfo } from "../../api/documentStudio";
import { useNavigate } from "@/lib/router";

const TYPE_ICONS: Record<DocumentType, string> = {
  commercial_proposal:    "📄",
  client_progress_report: "📊",
  meeting_summary:        "📝",
  market_research_brief:  "🔍",
  administrative_template:"📋",
  custom:                 "✏️",
};

function TypeCard({ t, selected, onClick }: { t: DocumentTypeInfo; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl p-3 border text-left transition-all ${
        selected
          ? "border-[#1A4E8C] bg-[#1A4E8C]/5 ring-1 ring-[#1A4E8C]/20"
          : "border-stone-100 bg-white hover:border-stone-200 hover:bg-stone-50"
      }`}
    >
      <span className="text-xl">{TYPE_ICONS[t.slug]}</span>
      <div>
        <p className="text-sm font-medium text-[#0F0F0D]">{t.label}</p>
        <p className="text-xs text-stone-400">max {t.maxPages} pages</p>
      </div>
    </button>
  );
}

export default function DocumentStudio() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();

  const [step, setStep]               = useState<"form" | "result">("form");
  const [docType, setDocType]         = useState<DocumentType>("commercial_proposal");
  const [title, setTitle]             = useState("");
  const [brief, setBrief]             = useState("");
  const [taskId, setTaskId]           = useState<string | null>(null);
  const [content, setContent]         = useState("");
  const [legalIssues, setLegalIssues] = useState<string[]>([]);

  const { data: typesData } = useQuery({
    queryKey:  ["document-types", selectedCompanyId],
    queryFn:   () => documentStudioApi.types(selectedCompanyId!),
    enabled:   !!selectedCompanyId,
    staleTime: Infinity,
  });

  const types = typesData?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => documentStudioApi.generate(selectedCompanyId!, { documentType: docType, title, brief }),
    onSuccess: (res) => {
      setTaskId(res.data.taskId);
      setContent(res.data.content);
      setLegalIssues(res.data.missingClauses);
      setStep("result");
    },
  });

  const canSubmit = title.trim().length > 0 && brief.trim().length >= 10;

  return (
    <div className="min-h-screen bg-[#FAFAF7] px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-2xl flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1A4E8C]/10 flex items-center justify-center">
            <FileText size={18} className="text-[#1A4E8C]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#0F0F0D]">Document studio</h1>
            <p className="text-sm text-stone-500">A 5-minute brief. A professional document.</p>
          </div>
        </div>

        {step === "form" && (
          <>
            {/* Type picker */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Document type</p>
              <div className="grid grid-cols-2 gap-2">
                {types.map((t) => (
                  <TypeCard
                    key={t.slug}
                    t={t}
                    selected={docType === t.slug}
                    onClick={() => setDocType(t.slug)}
                  />
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                Document title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Commercial proposal — Acme Corp"
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#0F0F0D] placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-[#1A4E8C]/30"
              />
            </div>

            {/* Brief */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                Your brief
              </label>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={6}
                placeholder="Describe the context, key points, recipient, and goal of the document…"
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#0F0F0D] placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-[#1A4E8C]/30 resize-none"
              />
              <p className="text-xs text-stone-400">{brief.length} characters</p>
            </div>

            {/* Submit */}
            <button
              onClick={() => mutation.mutate()}
              disabled={!canSubmit || mutation.isPending}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A4E8C] text-white font-medium text-sm hover:bg-[#153F70] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  Generate document
                  <ChevronRight size={16} />
                </>
              )}
            </button>

            {mutation.isError && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">Generation failed. Please try again.</p>
              </div>
            )}
          </>
        )}

        {step === "result" && (
          <div className="flex flex-col gap-4">
            {/* Success header */}
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700">Document generated — awaiting approval</p>
                <p className="text-xs text-emerald-600">Find it in your pending approvals.</p>
              </div>
            </div>

            {/* Legal warning if needed */}
            {legalIssues.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-700 mb-1">Missing clauses detected:</p>
                  <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">
                    {legalIssues.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* Content preview */}
            <div className="rounded-xl bg-white border border-stone-100 p-4 max-h-96 overflow-y-auto">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-3">Preview</p>
              <pre className="text-sm text-[#0F0F0D] whitespace-pre-wrap font-sans leading-relaxed">
                {content}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {taskId && (
                <button
                  onClick={() => navigate(`taches/${taskId}`)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A4E8C] text-white font-medium text-sm hover:bg-[#153F70] transition-colors"
                >
                  View task <ArrowRight size={14} />
                </button>
              )}
              <button
                onClick={() => { setStep("form"); setContent(""); setTaskId(null); }}
                className="px-4 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium text-sm hover:bg-stone-50 transition-colors"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
