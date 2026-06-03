/**
 * ui/src/pages/singular/ConsoleCEO.tsx
 *
 * CEO Console — M13 + WAR-6/7/8/9/10/12.
 *
 * Layout (top → bottom):
 *   1. Header + dispatcher health LED (WAR-10)
 *   2. Operatives floor (WAR-6/7/8) — collapsible, shows agent discs + delegation arrows
 *   3. Morning intelligence banner — unread cards requiring attention
 *   4. Mission thread / chat
 *   5. Suggestion chips + input
 *
 * Session gap briefing (Gap K) is shown as a modal overlay when the
 * operator returns after ≥6h absence — handled at app root level.
 */

import { useState, useRef, useEffect } from "react";
import { Send, Lightbulb, X, CheckCircle2, Mic, ChevronDown, ChevronUp, Circle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { useNavigate } from "@/lib/router";
import { consoleApi, type ConsoleCard } from "@/api/console";
import { missionsApi } from "@/api/missions";
import { OperativesFloor, type OperativeAgent } from "@/components/singular/OperativesFloor";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id:        string;
  role:      "user" | "assistant";
  text:      string;
  timestamp: string;
  missionId?: string;
}

interface DispatcherHealth {
  status:      "working" | "idle";
  message:     string;
  activeTasks: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function now() {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function urgencyColor(urgency: number) {
  if (urgency >= 4) return "#B91C1C";
  if (urgency >= 2) return "#C97C0A";
  return "#1A4E8C";
}

// ── Dispatcher health LED (WAR-10) ────────────────────────────────────────────

function DispatcherLed({ companyId }: { companyId: string }) {
  const { data } = useQuery<DispatcherHealth>({
    queryKey: ["dispatcher-health", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/dispatcher-health`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("health check failed");
      return res.json();
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const isWorking = data?.status === "working";
  const label = data?.message ?? "All systems running";

  return (
    <div className="flex items-center gap-1.5">
      <Circle
        size={8}
        className={isWorking ? "animate-pulse" : ""}
        style={{
          fill:   isWorking ? "#1A9E68" : "#8A8680",
          color:  isWorking ? "#1A9E68" : "#8A8680",
        }}
      />
      <span className="text-xs hidden sm:block" style={{ color: "#8A8680" }}>{label}</span>
    </div>
  );
}

// ── Intelligence card row ─────────────────────────────────────────────────────

function CardRow({
  card, onApprove, approving, approved,
}: {
  card: ConsoleCard;
  onApprove: (card: ConsoleCard) => void;
  approving: boolean;
  approved: boolean;
}) {
  return (
    <li className="text-sm flex items-start gap-2.5 py-2 border-b last:border-0"
      style={{ borderColor: "#1A4E8C22", color: "#1A4E8C" }}>
      <span className="flex-none mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ backgroundColor: urgencyColor(card.urgency) + "22", color: urgencyColor(card.urgency) }}>
        {card.urgency}
      </span>
      <span className="flex-1 leading-snug">{card.headline}</span>
      {card.taskId && !approved && (
        <button onClick={() => onApprove(card)} disabled={approving}
          className="flex-none text-xs font-semibold px-2.5 py-1 rounded-lg disabled:opacity-50"
          style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}>
          {approving ? "…" : "Approve"}
        </button>
      )}
      {approved && <CheckCircle2 size={16} className="flex-none text-[#1A9E68]" />}
    </li>
  );
}

// ── Empty chat state ──────────────────────────────────────────────────────────

function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-[#1A9E68]/10 flex items-center justify-center">
        <Send size={20} color="#1A9E68" />
      </div>
      <div>
        <p className="font-medium text-[#0F0F0D] text-sm">Tell your team what to do</p>
        <p className="text-sm text-[#8A8680] mt-1 max-w-xs">
          Type an instruction and your agents will handle it.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConsoleCEO() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [messages, setMessages]             = useState<Message[]>([]);
  const [inputValue, setInputValue]         = useState("");
  const [showIntelligence, setShowIntelligence] = useState(true);
  const [showFloor, setShowFloor]           = useState(true);
  const [approvedIds, setApprovedIds]       = useState<Set<string>>(new Set());
  const [approvingId, setApprovingId]       = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  // Morning intelligence cards
  const { data: context } = useQuery({
    queryKey:  ["console-context", selectedCompanyId],
    queryFn:   () => consoleApi.getContext(selectedCompanyId!),
    enabled:   !!selectedCompanyId,
    staleTime: 30_000,
  });

  // Operatives floor data — polled every 10s (WAR-6)
  const { data: floorData } = useQuery<{ agents: OperativeAgent[] }>({
    queryKey:  ["agents-floor", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${selectedCompanyId}/agents-floor`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("floor fetch failed");
      return res.json();
    },
    enabled:       !!selectedCompanyId,
    staleTime:     8_000,
    refetchInterval: 10_000,
  });

  const floorAgents: OperativeAgent[] = floorData?.agents ?? [];
  const liveCards: ConsoleCard[]      = context?.cards ?? [];

  // Send mission
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const title = text.length > 60 ? text.slice(0, 57) + "…" : text;
      return missionsApi.create(selectedCompanyId!, { title, brief: text });
    },
    onSuccess: (mission) => {
      setMessages((prev) => [...prev, {
        id:        Date.now().toString(),
        role:      "assistant",
        missionId: mission.id,
        text:      `Mission created: "${mission.title}". Your team is on it — you'll see updates in real time.`,
        timestamp: now(),
      }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, {
        id:        Date.now().toString(),
        role:      "assistant",
        text:      "Something went wrong. Please try again.",
        timestamp: now(),
      }]);
    },
  });

  // Approve card
  const approveMutation = useMutation({
    mutationFn: ({ cardId }: { cardId: string }) =>
      consoleApi.approveCard(selectedCompanyId!, cardId, "me"),
    onSuccess: (_, { cardId }) => {
      setApprovedIds((prev) => new Set([...prev, cardId]));
      setApprovingId(null);
      queryClient.invalidateQueries({ queryKey: ["console-context"] });
      setMessages((prev) => [...prev, {
        id: Date.now().toString(), role: "assistant",
        text: "Approved. The team will continue.", timestamp: now(),
      }]);
    },
    onError: () => setApprovingId(null),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMutation.isPending]);

  function handleSend() {
    const text = inputValue.trim();
    if (!text || sendMutation.isPending) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", text, timestamp: now() }]);
    setInputValue("");
    sendMutation.mutate(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const suggestions = [
    "What did the team accomplish this week?",
    "Draft a proposal for a new client",
    "Show me pending approvals",
  ];

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#FAFAF8" }}>

      {/* ── Header + dispatcher health (WAR-10) ── */}
      <div className="flex-none px-5 py-3 border-b flex items-center justify-between gap-3"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}>
        <div>
          <h1 className="text-xl" style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}>
            Console CEO
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {selectedCompanyId && <DispatcherLed companyId={selectedCompanyId} />}
          <button onClick={() => navigate("voice")} title="Note vocale"
            className="p-2 rounded-xl border border-[#E8E4DC] hover:bg-[#F0EDE8] transition-colors">
            <Mic size={15} style={{ color: "#8A8680" }} />
          </button>
        </div>
      </div>

      {/* ── Operatives floor (WAR-6/7/8) ── */}
      {floorAgents.length > 0 && (
        <div className="flex-none border-b" style={{ borderColor: "#E8E4DC" }}>
          <button
            onClick={() => setShowFloor((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-2 text-xs font-semibold text-[#8A8680] hover:text-[#0F0F0D] transition-colors"
          >
            <span>
              Your team
              {floorAgents.filter((a) => a.currentTask).length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: "#1A9E6815", color: "#1A9E68" }}>
                  {floorAgents.filter((a) => a.currentTask).length} active
                </span>
              )}
            </span>
            {showFloor ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showFloor && (
            <div className="h-44" style={{ backgroundColor: "#FAFAF8" }}>
              <OperativesFloor agents={floorAgents} />
            </div>
          )}
        </div>
      )}

      {/* ── Morning intelligence banner ── */}
      {showIntelligence && liveCards.length > 0 && (
        <div className="flex-none mx-4 mt-3 rounded-xl border p-4"
          style={{ backgroundColor: "#EFF6FF", borderColor: "#1A4E8C33" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 flex-1">
              <Lightbulb size={17} className="flex-none mt-0.5" style={{ color: "#1A4E8C" }} />
              <div className="flex-1">
                <p className="text-sm font-semibold mb-2" style={{ color: "#1A4E8C" }}>
                  {liveCards.length} point{liveCards.length !== 1 ? "s" : ""} need your attention
                </p>
                <div className="w-full mb-3" style={{ height: "1px", backgroundColor: "#1A4E8C22" }} />
                <ul className="divide-y" style={{ borderColor: "#1A4E8C22" }}>
                  {liveCards.map((card) => (
                    <CardRow key={card.id} card={card}
                      onApprove={(c) => { setApprovingId(c.id); approveMutation.mutate({ cardId: c.id }); }}
                      approving={approvingId === card.id}
                      approved={approvedIds.has(card.id)} />
                  ))}
                </ul>
                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                  <button className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 w-full sm:w-auto"
                    style={{ backgroundColor: "#1A4E8C", color: "#FFFFFF" }}
                    onClick={() => { setShowIntelligence(false); navigate("/approvals/pending"); }}>
                    Review all
                  </button>
                  <button className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-80 w-full sm:w-auto"
                    style={{ backgroundColor: "transparent", color: "#1A4E8C", border: "1px solid #1A4E8C44" }}
                    onClick={() => setShowIntelligence(false)}>
                    Later
                  </button>
                </div>
              </div>
            </div>
            <button onClick={() => setShowIntelligence(false)}
              className="flex-none hover:opacity-70 mt-0.5" style={{ color: "#8A8680" }}>
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Mission thread ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? <EmptyChat /> : messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="flex items-start gap-2 max-w-[80%]">
                <div className="flex-none w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ backgroundColor: "#1A9E6820", color: "#1A9E68" }}>S</div>
                <div>
                  <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
                    style={{ backgroundColor: "#FFFFFF", color: "#0F0F0D", border: "1px solid #E8E4DC" }}>
                    {msg.text}
                    {msg.missionId && (
                      <button onClick={() => navigate("missions/archive")}
                        className="mt-2 block text-xs text-[#1A4E8C] hover:underline">
                        View mission →
                      </button>
                    )}
                  </div>
                  <p className="text-xs mt-1 ml-1" style={{ color: "#8A8680" }}>{msg.timestamp}</p>
                </div>
              </div>
            )}
            {msg.role === "user" && (
              <div className="max-w-[80%]">
                <div className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
                  style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}>{msg.text}</div>
                <p className="text-xs mt-1 mr-1 text-right" style={{ color: "#8A8680" }}>{msg.timestamp}</p>
              </div>
            )}
          </div>
        ))}
        {sendMutation.isPending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: "#1A9E6820", color: "#1A9E68" }}>S</div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E4DC" }}>
                <div className="flex gap-1 items-center">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ backgroundColor: "#8A8680", animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Suggestion chips ── */}
      <div className="flex-none px-4 pb-2 flex gap-2 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => { setInputValue(s); textareaRef.current?.focus(); }}
            className="text-xs px-3 py-1.5 rounded-full border hover:opacity-80 whitespace-nowrap flex-shrink-0 transition-colors"
            style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC", color: "#8A8680" }}>
            {s}
          </button>
        ))}
      </div>

      {/* ── Input ── */}
      <div className="flex-none px-4 pb-4">
        <div className="flex items-end gap-2 rounded-2xl border p-3"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}>
          <textarea ref={textareaRef} value={inputValue}
            onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Tell your team what to do…" rows={1}
            className="flex-1 resize-none text-sm outline-none bg-transparent leading-relaxed"
            style={{ color: "#0F0F0D", maxHeight: "120px" }} />
          <button onClick={handleSend} disabled={!inputValue.trim() || sendMutation.isPending}
            className="flex-none w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40"
            style={{ backgroundColor: "#1A9E68" }}>
            <Send size={14} color="#FFFFFF" />
          </button>
        </div>
      </div>
    </div>
  );
}
