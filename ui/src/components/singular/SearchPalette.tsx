/**
 * ui/src/components/singular/SearchPalette.tsx
 *
 * Command-K search palette — full company search.
 * Opens on Cmd+K / Ctrl+K. Searches issues, documents, agents, comments.
 * Results ranked by trigram similarity, navigates on click/Enter.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { useNavigate } from "@/lib/router";
import { Search, FileText, Zap, MessageSquare, Users, X, ArrowRight } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  type:       "issue" | "document" | "agent" | "comment";
  id:         string;
  title:      string;
  snippet?:   string;
  url:        string;
  meta?:      string;
  similarity: number;
}

// ── API ───────────────────────────────────────────────────────────────────────

async function search(companyId: string, q: string): Promise<SearchResult[]> {
  if (q.length < 2) return [];
  const res = await fetch(
    `/api/companies/${companyId}/search?q=${encodeURIComponent(q)}&limit=20`,
    { credentials: "include" },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

// ── Icon per type ─────────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: SearchResult["type"] }) {
  const props = { size: 13, className: "flex-none" };
  switch (type) {
    case "issue":    return <Zap        {...props} style={{ color: "#1A4E8C" }} />;
    case "document": return <FileText   {...props} style={{ color: "#C97C0A" }} />;
    case "agent":    return <Users      {...props} style={{ color: "#1A9E68" }} />;
    case "comment":  return <MessageSquare {...props} style={{ color: "#8A8680" }} />;
  }
}

function TypeLabel({ type }: { type: SearchResult["type"] }) {
  const labels = { issue: "Task", document: "Doc", agent: "Agent", comment: "Comment" };
  return <span className="text-[10px] text-[#8A8680]">{labels[type]}</span>;
}

// ── Palette ───────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function SearchPalette({ open, onClose }: Props) {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const navigate  = useNavigate();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey:    ["search", selectedCompanyId, q],
    queryFn:     () => search(selectedCompanyId!, q),
    enabled:     open && !!selectedCompanyId && q.length >= 2,
    staleTime:   10_000,
    placeholderData: (prev) => prev,
  });

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQ("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when results change
  useEffect(() => { setSelected(0); }, [results]);

  const navigate_ = useCallback((result: SearchResult) => {
    const base = `/${selectedCompany?.issuePrefix ?? ""}`;
    const url = result.type === "agent"
      ? `${base}/team`
      : result.type === "document"
      ? `${base}/documents`
      : result.url;
    navigate(url);
    onClose();
  }, [navigate, onClose, selectedCompany]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape")     { onClose(); return; }
    if (e.key === "ArrowDown")  { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp")    { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) { navigate_(results[selected]); }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      style={{ backgroundColor: "rgba(15,15,13,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: "#FFFFFF", maxHeight: "65vh" }}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "#E8E4DC" }}>
          <Search size={16} style={{ color: "#8A8680" }} className="flex-none" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search tasks, documents, agents…"
            className="flex-1 text-sm outline-none bg-transparent text-[#0F0F0D] placeholder:text-[#8A8680]"
          />
          {isFetching && (
            <div className="w-3.5 h-3.5 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin flex-none" />
          )}
          <kbd
            onClick={onClose}
            className="text-[10px] text-[#8A8680] bg-[#F5F5F3] px-1.5 py-0.5 rounded cursor-pointer hover:bg-[#E8E4DC]"
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {q.length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-[#8A8680]">
              Type at least 2 characters to search
            </div>
          ) : results.length === 0 && !isFetching ? (
            <div className="px-4 py-8 text-center text-sm text-[#8A8680]">
              No results for <strong>"{q}"</strong>
            </div>
          ) : (
            <ul className="py-1">
              {results.map((r, i) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    onClick={() => navigate_(r)}
                    onMouseEnter={() => setSelected(i)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      i === selected ? "bg-[#F0EDE8]" : "hover:bg-[#FAFAF8]"
                    }`}
                  >
                    <TypeIcon type={r.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#0F0F0D] truncate">{r.title}</p>
                      {r.snippet && (
                        <p className="text-xs text-[#8A8680] truncate">{r.snippet}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-none">
                      <TypeLabel type={r.type} />
                      {r.meta && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5F5F3] text-[#8A8680]">
                          {r.meta}
                        </span>
                      )}
                      {i === selected && <ArrowRight size={11} style={{ color: "#8A8680" }} />}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t flex items-center gap-4 text-[10px] text-[#8A8680]" style={{ borderColor: "#E8E4DC" }}>
          <span><kbd className="bg-[#F5F5F3] px-1 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="bg-[#F5F5F3] px-1 rounded">↵</kbd> open</span>
          <span><kbd className="bg-[#F5F5F3] px-1 rounded">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
