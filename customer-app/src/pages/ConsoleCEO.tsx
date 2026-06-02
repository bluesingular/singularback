/**
 * ConsoleCEO — M13: CEO Console proactive mode.
 *
 * 50/50 split:
 *   Left  — Mission Control: Chat tab (mission thread + input) | Board tab (4-col kanban)
 *   Right — Operatives Floor: agent discs, LEDs, speech bubbles, delegation arrows
 *
 * All user-facing strings from EMOTIONAL_LAYER.md.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import {
  agentsApi, missionsApi, tasksApi, approvalsApi, clientContextsApi,
  type Agent, type Mission, type MissionDetail, type MissionMessage, type Task,
  type ClientContext,
} from "../api/client";
import { X, ChevronRight } from "lucide-react";
import { RetrainModal } from "../components/RetrainModal";

// ── Constants ─────────────────────────────────────────────────────────────────

const TASK_STATUSES: Record<string, { col: number; label: string }> = {
  pending:                  { col: 0, label: "En attente" },
  running:                  { col: 1, label: "En cours" },
  pending_approval:         { col: 2, label: "Votre attention" },
  awaiting_clarification:   { col: 2, label: "Votre attention" },
  approved:                 { col: 1, label: "En cours" },
  completed:                { col: 3, label: "Terminé" },
  failed:                   { col: 3, label: "Terminé" },
  cancelled:                { col: 3, label: "Terminé" },
  partial_complete:         { col: 2, label: "Votre attention" },
  blocked_collision:        { col: 2, label: "Votre attention" },
};

const COLUMNS = [
  "En attente",
  "En cours",
  "Votre attention",
  "Terminé",
];

// ── SSE hook ──────────────────────────────────────────────────────────────────

interface SseAgentEvent {
  type: "agent.writing" | "agent.tool_call" | "agent.reading" | "agent.analysing" | "task.started" | "task.completed" | "task.blocked";
  data: { agentId?: string; fragment?: string; chunk?: string; toolName?: string; taskId?: string };
}

function useSse(companyId: string | undefined, onEvent: (e: SseAgentEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!companyId) return;
    const es = new EventSource("/api/v1/events/stream", { withCredentials: true });
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as SseAgentEvent;
        onEventRef.current(parsed);
      } catch { /* ignore malformed */ }
    };
    return () => es.close();
  }, [companyId]);
}

// ── Agent disc LED ────────────────────────────────────────────────────────────

type LedState = "working" | "idle" | "attention" | "paused";

function getLedState(agent: Agent, activeTasks: Task[]): LedState {
  if (agent.status === "paused") return "paused";
  if (agent.status === "deactivated") return "idle";
  const agentTasks = activeTasks.filter((t) => t.agentId === agent.id);
  if (agentTasks.some((t) => t.status === "pending_approval" || t.status === "awaiting_clarification" || t.status === "partial_complete")) return "attention";
  if (agentTasks.some((t) => t.status === "running" || t.status === "approved")) return "working";
  return "idle";
}

function Led({ state }: { state: LedState }) {
  const base = "w-2.5 h-2.5 rounded-full absolute top-1 right-1";
  if (state === "working")  return <span className={`${base} bg-green-400 animate-pulse`} />;
  if (state === "attention") return <span className={`${base} bg-amber-400 animate-pulse`} />;
  if (state === "paused")   return <span className={`${base} bg-red-500`} />;
  return <span className={`${base} bg-blue-400`} />;
}

// ── Agent avatar (Dicebear Notionists) ────────────────────────────────────────

function AgentAvatar({ slug, size = 48 }: { slug: string; size?: number }) {
  const src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(slug)}&size=${size}`;
  return <img src={src} alt="" width={size} height={size} className="rounded-full object-cover" />;
}

// ── Speech bubble ─────────────────────────────────────────────────────────────

function SpeechBubble({ text, colour }: { text: string; colour: string }) {
  return (
    <div
      className="absolute -top-14 left-1/2 -translate-x-1/2 w-40 rounded-xl px-3 py-2 text-xs text-white shadow-lg pointer-events-none"
      style={{ backgroundColor: colour, maxWidth: 160 }}
    >
      <span className="line-clamp-2 leading-tight">{text.slice(0, 80)}</span>
      {/* tail */}
      <span
        className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
        style={{ backgroundColor: colour }}
      />
    </div>
  );
}

// ── Agent disc ────────────────────────────────────────────────────────────────

function AgentDisc({
  agent,
  ledState,
  bubble,
  onClick,
}: {
  agent: Agent;
  ledState: LedState;
  bubble?: string;
  onClick: () => void;
}) {
  const colour = agent.colour ?? "#3B82F6";
  const borderStyle = agent.status === "paused" ? "dashed" : "solid";

  return (
    <div className="relative flex flex-col items-center gap-2 cursor-pointer select-none" onClick={onClick}>
      {bubble && <SpeechBubble text={bubble} colour={colour} />}
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: 80,
          height: 80,
          backgroundColor: `${colour}26`,
          border: `4px ${borderStyle} ${colour}`,
        }}
      >
        <AgentAvatar slug={agent.slug ?? agent.id} size={48} />
        <Led state={ledState} />
      </div>
      <span className="text-xs font-semibold text-[#1A1A1A] max-w-[88px] text-center truncate">
        {agent.displayName ?? agent.name}
      </span>
    </div>
  );
}

// ── Drill-down panel ──────────────────────────────────────────────────────────

function DrillDown({
  agent,
  tasks,
  onClose,
}: {
  agent: Agent;
  tasks: Task[];
  onClose: () => void;
}) {
  const [showRetrain, setShowRetrain] = useState(false);
  const colour = agent.colour ?? "#3B82F6";
  const agentTasks = tasks.filter((t) => t.agentId === agent.id);
  const current = agentTasks.find((t) => t.status === "running" || t.status === "approved" || t.status === "pending_approval");
  const queue   = agentTasks.filter((t) => t.status === "pending");
  const recent  = agentTasks.filter((t) => t.status === "completed" || t.status === "failed").slice(0, 5);

  const statusLabel: Record<string, string> = {
    running: "En cours",
    approved: "Approuvé",
    pending_approval: "En attente d'approbation",
    awaiting_clarification: "En attente de précision",
    pending: "En attente",
    completed: "Terminé",
    failed: "Échec",
    cancelled: "Annulé",
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[40vw] min-w-72 bg-white border-l border-[#E8E4DC] shadow-xl z-50 flex flex-col overflow-y-auto">
      <div className="flex items-center gap-3 p-4 border-b border-[#E8E4DC]">
        <div
          className="w-3 h-full rounded-full absolute left-0 top-0 bottom-0"
          style={{ backgroundColor: colour }}
        />
        <AgentAvatar slug={agent.slug ?? agent.id} size={40} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[#1A1A1A]">{agent.displayName ?? agent.name}</p>
          <span
            className="text-xs px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: colour }}
          >
            {agent.status === "active" ? "Actif" : agent.status === "paused" ? "En pause" : "Désactivé"}
          </span>
        </div>
        <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#1A1A1A]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {current && (
          <section>
            <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide mb-2">Tâche en cours</p>
            <div className="bg-[#F5F2EE] rounded-lg p-3">
              <p className="text-sm font-medium text-[#1A1A1A]">{current.title}</p>
              <p className="text-xs text-[#6B6B6B] mt-1">{statusLabel[current.status] ?? current.status}</p>
            </div>
          </section>
        )}

        {queue.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide mb-2">File d'attente ({queue.length})</p>
            <div className="space-y-1.5">
              {queue.map((t) => (
                <div key={t.id} className="text-xs text-[#1A1A1A] bg-[#FAFAF8] rounded-md px-3 py-2 border border-[#E8E4DC]">
                  {t.title}
                </div>
              ))}
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide mb-2">Récentes</p>
            <div className="space-y-1.5">
              {recent.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs text-[#6B6B6B]">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.status === "completed" ? "bg-green-400" : "bg-red-400"}`} />
                  <span className="truncate">{t.title}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {!current && queue.length === 0 && (
          <p className="text-sm text-[#6B6B6B] text-center py-6">Aucune tâche active</p>
        )}

        {/* WAR-11: Retrain / configure button */}
        <div className="pt-2 border-t border-[#E8E4DC]">
          <button
            onClick={() => setShowRetrain(true)}
            className="w-full text-left text-sm text-[#1A9E68] font-medium hover:underline"
          >
            Configurer {agent.displayName ?? agent.name} →
          </button>
        </div>
      </div>

      {showRetrain && (
        <RetrainModal agent={agent} onClose={() => setShowRetrain(false)} />
      )}
    </div>
  );
}

// ── Mission thread ────────────────────────────────────────────────────────────

function MissionThread({
  messages,
  companyId,
  missionId,
  onSent,
}: {
  messages: MissionMessage[];
  companyId: string;
  missionId: string;
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const send = useMutation({
    mutationFn: () => missionsApi.addMessage(companyId, missionId, text.trim()),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["mission", companyId, missionId] });
      onSent();
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) send.mutate();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-[#1A9E68] text-white"
                  : msg.role === "orchestrator"
                  ? "bg-white border border-[#E8E4DC] text-[#1A1A1A]"
                  : "bg-[#F5F2EE] text-[#6B6B6B] text-xs italic"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-[#E8E4DC] p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Quelle est votre prochaine mission ?"
          rows={2}
          className="w-full resize-none text-sm rounded-lg border border-[#E8E4DC] px-3 py-2 focus:outline-none focus:border-[#1A9E68] bg-[#FAFAF8] placeholder:text-[#C4BFB8]"
        />
        <div className="flex justify-end mt-1.5">
          <button
            onClick={() => text.trim() && send.mutate()}
            disabled={!text.trim() || send.isPending}
            className="text-xs bg-[#1A9E68] disabled:opacity-40 hover:bg-[#158a59] text-white px-3 py-1.5 rounded-md transition-colors"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kanban board ──────────────────────────────────────────────────────────────

function KanbanBoard({
  tasks,
  agents,
  attentionCount,
  onTaskClick,
}: {
  tasks: Task[];
  agents: Agent[];
  attentionCount: number;
  onTaskClick: (task: Task) => void;
}) {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const cols = COLUMNS.map((label, i) => ({
    label,
    tasks: tasks.filter((t) => (TASK_STATUSES[t.status]?.col ?? 0) === i),
  }));

  const elapsed = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}j`;
  };

  return (
    <div className="flex gap-3 h-full overflow-x-auto px-4 py-3">
      {cols.map(({ label, tasks: colTasks }, colIdx) => (
        <div key={label} className="flex-1 min-w-36 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#6B6B6B]">{label}</span>
            {colIdx === 2 && attentionCount > 0 && (
              <span className="bg-amber-400 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {attentionCount}
              </span>
            )}
          </div>
          <div className="space-y-2 overflow-y-auto flex-1">
            {colTasks.map((task) => {
              const agent = task.agentId ? agentMap.get(task.agentId) : undefined;
              return (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="bg-white border border-[#E8E4DC] rounded-lg px-3 py-2.5 cursor-pointer hover:border-[#C4BFB8] transition-colors"
                >
                  {agent && (
                    <div
                      className="w-full h-0.5 rounded-full mb-2"
                      style={{ backgroundColor: agent.colour ?? "#E8E4DC" }}
                    />
                  )}
                  <p className="text-xs font-medium text-[#1A1A1A] line-clamp-2">{task.title}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {agent && (
                      <span className="text-[10px] text-[#6B6B6B]">{agent.displayName ?? agent.name}</span>
                    )}
                    <span className="ml-auto text-[10px] text-[#C4BFB8]">{elapsed(task.createdAt)}</span>
                  </div>
                </div>
              );
            })}
            {colTasks.length === 0 && (
              <div className="text-[10px] text-[#C4BFB8] text-center py-4">—</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mission selector / creator ────────────────────────────────────────────────

function MissionPicker({
  missions,
  selected,
  onSelect,
  onNew,
  companyId,
}: {
  missions: Mission[];
  selected?: string;
  onSelect: (id: string) => void;
  onNew: (title: string) => void;
  companyId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  const submit = () => {
    if (title.trim()) {
      onNew(title.trim());
      setTitle("");
      setCreating(false);
    }
  };

  return (
    <div className="border-b border-[#E8E4DC] px-4 py-2 flex items-center gap-2 overflow-x-auto">
      {missions.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
            m.id === selected
              ? "bg-[#1A9E68] text-white"
              : "bg-[#F5F2EE] text-[#6B6B6B] hover:bg-[#E8E4DC]"
          }`}
        >
          {m.title}
        </button>
      ))}
      {creating ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Nom de la mission…"
            className="text-xs border border-[#E8E4DC] rounded-md px-2 py-1 w-36 focus:outline-none focus:border-[#1A9E68]"
          />
          <button onClick={submit} className="text-xs text-[#1A9E68] font-medium">OK</button>
          <button onClick={() => setCreating(false)} className="text-xs text-[#6B6B6B]">✕</button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] flex-shrink-0 flex items-center gap-1"
        >
          + Nouvelle mission
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// ── Client context selector ───────────────────────────────────────────────────

function ClientContextSelector({
  contexts,
  selected,
  onSelect,
}: {
  contexts: ClientContext[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (contexts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-[#E8E4DC]">
      <span className="text-xs text-[#6B6B6B]">Client :</span>
      <select
        value={selected ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className="text-xs border border-[#E8E4DC] rounded-md px-2 py-1 bg-[#FAFAF8] focus:outline-none focus:border-[#1A9E68]"
      >
        <option value="">Tous les clients</option>
        {contexts.map((ctx) => (
          <option key={ctx.id} value={ctx.id}>{ctx.name}</option>
        ))}
      </select>
    </div>
  );
}

export default function ConsoleCEO() {
  const { companyId } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"chat" | "board">("chat");
  const [selectedMissionId, setSelectedMissionId] = useState<string | undefined>();
  const [selectedAgent, setSelectedAgent] = useState<Agent | undefined>();
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const [selectedClientCtxId, setSelectedClientCtxId] = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: agentsData } = useQuery({
    queryKey: ["agents", companyId],
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
    refetchInterval: 30_000,
  });

  const { data: tasksData } = useQuery({
    queryKey: ["tasks", companyId],
    queryFn: () => tasksApi.list(companyId!),
    enabled: !!companyId,
    refetchInterval: 15_000,
  });

  const { data: clientContextsData } = useQuery({
    queryKey: ["client-contexts", companyId],
    queryFn: () => clientContextsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: missionsData } = useQuery({
    queryKey: ["missions", companyId, selectedClientCtxId],
    queryFn: () => selectedClientCtxId
      ? clientContextsApi.missions(companyId!, selectedClientCtxId)
      : missionsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: missionDetail } = useQuery({
    queryKey: ["mission", companyId, selectedMissionId],
    queryFn: () => missionsApi.get(companyId!, selectedMissionId!),
    enabled: !!companyId && !!selectedMissionId,
    refetchInterval: 10_000,
  });

  const { data: approvalsData } = useQuery({
    queryKey: ["approvals", companyId],
    queryFn: () => approvalsApi.pending(companyId!),
    enabled: !!companyId,
    refetchInterval: 15_000,
  });

  const createMission = useMutation({
    mutationFn: (title: string) =>
      missionsApi.create(companyId!, { title, brief: title }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["missions", companyId] });
      setSelectedMissionId(data.id);
    },
  });




  const agents: Agent[] = agentsData ?? [];
  const tasks: Task[] = (tasksData as any)?.issues ?? [];
  const missions: Mission[] = (missionsData as any)?.missions ?? [];
  const clientContexts: ClientContext[] = (clientContextsData as any)?.contexts ?? [];
  const messages: MissionMessage[] = missionDetail?.messages ?? [];

  // Auto-select first mission
  useEffect(() => {
    if (!selectedMissionId && missions.length > 0) {
      setSelectedMissionId(missions[0].id);
    }
  }, [missions, selectedMissionId]);

  // ── SSE live updates ────────────────────────────────────────────────────────

  const handleSse = useCallback((event: SseAgentEvent) => {
    if (event.type === "agent.writing" || event.type === "agent.tool_call") {
      const agentId = event.data.agentId;
      if (!agentId) return;
      const text = event.type === "agent.writing"
        ? event.data.fragment ?? event.data.chunk ?? ""
        : `⚙ ${event.data.toolName ?? "outil"}`;
      setBubbles((prev) => ({ ...prev, [agentId]: text }));
    }
    if (event.type === "task.completed" || event.type === "task.blocked") {
      // Clear bubble for agent when task ends
      if (event.data.agentId) {
        setBubbles((prev) => { const n = { ...prev }; delete n[event.data.agentId!]; return n; });
      }
      qc.invalidateQueries({ queryKey: ["tasks", companyId] });
      qc.invalidateQueries({ queryKey: ["approvals", companyId] });
    }
    if (event.type === "task.started") {
      qc.invalidateQueries({ queryKey: ["tasks", companyId] });
    }
  }, [companyId, qc]);

  useSse(companyId ?? undefined, handleSse);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const visibleAgents = agents.filter((a) => a.status !== "deactivated" && a.teamRosterVisible !== false);
  const attentionCount = (approvalsData?.approvals?.length ?? 0) +
    tasks.filter((t) => t.status === "awaiting_clarification" || t.status === "partial_complete").length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#FAFAF8]">
      <ClientContextSelector
        contexts={clientContexts}
        selected={selectedClientCtxId}
        onSelect={(id) => { setSelectedClientCtxId(id); setSelectedMissionId(undefined); }}
      />
      <div className="flex flex-1 overflow-hidden">

      {/* ── LEFT: Mission Control ── */}
      <div className="w-1/2 flex flex-col border-r border-[#E8E4DC] min-w-0">
        {/* Tabs */}
        <div className="flex border-b border-[#E8E4DC] bg-white">
          {(["chat", "board"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-[#1A9E68] border-b-2 border-[#1A9E68]"
                  : "text-[#6B6B6B] hover:text-[#1A1A1A]"
              }`}
            >
              {tab === "chat" ? "Mission" : (
                <span className="flex items-center justify-center gap-1.5">
                  Tableau
                  {attentionCount > 0 && (
                    <span className="bg-amber-400 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {attentionCount}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "chat" && (
          <>
            <MissionPicker
              missions={missions}
              selected={selectedMissionId}
              onSelect={setSelectedMissionId}
              onNew={(t) => createMission.mutate(t)}
              companyId={companyId!}
            />
            <div className="flex-1 overflow-hidden">
              {selectedMissionId ? (
                <MissionThread
                  messages={messages}
                  companyId={companyId!}
                  missionId={selectedMissionId}
                  onSent={() => qc.invalidateQueries({ queryKey: ["mission", companyId, selectedMissionId] })}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                  <p className="text-sm font-medium text-[#1A1A1A]">Aucune mission active</p>
                  <p className="text-xs text-[#6B6B6B]">Créez une nouvelle mission pour démarrer.</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "board" && (
          <div className="flex-1 overflow-hidden">
            <KanbanBoard
              tasks={tasks}
              agents={agents}
              attentionCount={attentionCount}
              onTaskClick={(task) => {
                const agent = agents.find((a) => a.id === task.agentId);
                if (agent) setSelectedAgent(agent);
              }}
            />
          </div>
        )}
      </div>

      {/* ── RIGHT: Operatives Floor ── */}
      <div className="w-1/2 flex flex-col min-w-0">
        <div className="px-5 py-3 border-b border-[#E8E4DC] bg-white">
          <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide">Votre équipe</p>
        </div>

        {visibleAgents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[#6B6B6B]">
            Aucun agent actif
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-wrap gap-8 justify-start">
              {visibleAgents.map((agent) => {
                const ledState = getLedState(agent, tasks);
                const bubble = bubbles[agent.id];
                return (
                  <AgentDisc
                    key={agent.id}
                    agent={agent}
                    ledState={ledState}
                    bubble={bubble}
                    onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? undefined : agent)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Delegation arrows — SVG overlay (rendered inside operatives floor) */}
        {/* Arrows would require DOM position measurement; deferred to WAR-7 */}
      </div>

      {/* ── Drill-down panel ── */}
      {selectedAgent && (
        <DrillDown
          agent={selectedAgent}
          tasks={tasks}
          onClose={() => setSelectedAgent(undefined)}
        />
      )}
      </div>
    </div>
  );
}
