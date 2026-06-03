/**
 * ui/src/components/singular/OperativesFloor.tsx
 *
 * WAR-6: Operatives floor — real-time agent status display.
 * WAR-7: Delegation arrows (SVG marching ants).
 * WAR-8: Agent drill-down panel (slides in from right).
 *
 * Each agent is a disc with:
 *   - Filled circle in agent.colour at 15% opacity, 4px border
 *   - Dicebear Notionists avatar seeded by agent.slug (48px)
 *   - display_name placard below (14px semibold)
 *   - Status LED (8px dot, top-right)
 *
 * LED colours:
 *   🟢 pulsing green  → running (status: in_progress)
 *   🔵 static blue    → idle
 *   🟡 pulsing amber  → awaiting_clarification or in_review
 *   🔴 static red     → paused
 *   ⚪ hidden         → deactivated
 */

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ChevronRight } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Agent {
  id:          string;
  slug:        string;
  displayName: string;
  colour:      string;
  status:      string;          // active | paused | deactivated
  currentTask?: {
    id:       string;
    title:    string;
    status:   string;           // in_progress | in_review | awaiting_clarification
    fragment?: string;          // live reasoning fragment (SSE)
  } | null;
}

// ── LED ────────────────────────────────────────────────────────────────────────

function Led({ agentStatus, taskStatus }: { agentStatus: string; taskStatus?: string }) {
  if (agentStatus === "deactivated") return null;
  if (agentStatus === "paused") {
    return <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />;
  }
  if (taskStatus === "in_progress") {
    return <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 animate-pulse" />;
  }
  if (taskStatus === "in_review" || taskStatus === "awaiting_clarification") {
    return <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />;
  }
  return <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-400" />;
}

// ── Delegation arrows (WAR-7) ─────────────────────────────────────────────────

function DelegationArrows({
  agents,
  positions,
  activeTasksByAgent,
}: {
  agents: Agent[];
  positions: Map<string, { x: number; y: number }>;
  activeTasksByAgent: Map<string, boolean>;
}) {
  // Draw arrows from orchestrator to agents with running tasks
  const orchestrator = agents.find((a) => a.slug.includes("orchestr"));
  if (!orchestrator) return null;
  const srcPos = positions.get(orchestrator.id);
  if (!srcPos) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="#94a3b8" />
        </marker>
      </defs>
      {agents
        .filter((a) => a.id !== orchestrator.id && activeTasksByAgent.get(a.id))
        .map((target) => {
          const tPos = positions.get(target.id);
          if (!tPos) return null;
          const isRunning = target.currentTask?.status === "in_progress";
          return (
            <line
              key={target.id}
              x1={srcPos.x} y1={srcPos.y}
              x2={tPos.x}   y2={tPos.y}
              stroke={target.colour}
              strokeWidth={2}
              strokeDasharray={isRunning ? "6 3" : "4 4"}
              markerEnd="url(#arrowhead)"
              style={isRunning ? {
                animation: "marchingAnts 0.6s linear infinite",
                strokeDashoffset: 0,
              } : undefined}
            />
          );
        })}
      <style>{`
        @keyframes marchingAnts {
          to { stroke-dashoffset: -18; }
        }
      `}</style>
    </svg>
  );
}

// ── Drill-down panel (WAR-8) ──────────────────────────────────────────────────

function DrillDownPanel({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  return (
    <div
      className="fixed top-0 right-0 h-full w-[40vw] min-w-[320px] max-w-[480px] bg-white border-l border-stone-200 shadow-xl z-50 flex flex-col"
      style={{ animation: "slideIn 0.2s ease-out" }}
    >
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-stone-100">
        {/* Agent disc (small) */}
        <div
          className="relative w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: agent.colour + "26",
            border: `3px solid ${agent.colour}`,
          }}
        >
          <img
            src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(agent.slug)}&size=32`}
            alt={agent.displayName}
            className="w-8 h-8"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-900 truncate">{agent.displayName}</p>
          <p className="text-xs text-stone-500">
            {agent.status === "paused" ? "Paused" : agent.currentTask ? "Working" : "Available"}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-stone-100 text-stone-400">
          <X size={18} />
        </button>
      </div>

      {/* Current task */}
      <div className="p-4 flex-1 overflow-y-auto">
        {agent.currentTask ? (
          <div className="mb-4">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Tâche en cours</p>
            <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
              <p className="text-sm font-medium text-stone-900">{agent.currentTask.title}</p>
              {agent.currentTask.fragment && (
                <p className="text-xs text-stone-500 mt-1 italic">"{agent.currentTask.fragment}"</p>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: agent.colour }}
                />
                <span className="text-xs text-stone-500">
                  {agent.currentTask.status === "in_review" ? "En attente de validation"
                    : agent.currentTask.status === "awaiting_clarification" ? "Awaiting response"
                    : "Running"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-stone-400 italic mb-4">Aucune tâche en cours.</p>
        )}

        <div className="text-xs text-stone-400 mt-6 flex items-center gap-1">
          <ChevronRight size={12} />
          <span>Voir toutes les tâches dans le tableau de bord</span>
        </div>
      </div>
    </div>
  );
}

// ── Agent disc ─────────────────────────────────────────────────────────────────

function AgentDisc({
  agent,
  onClick,
  discRef,
}: {
  agent: Agent;
  onClick: () => void;
  discRef: (el: HTMLDivElement | null) => void;
}) {
  const isDeactivated = agent.status === "deactivated";
  if (isDeactivated) return null;

  const taskStatus = agent.currentTask?.status;
  const borderStyle = agent.status === "paused" ? "dashed" : "solid";
  const fragment = agent.currentTask?.fragment;

  return (
    <div className="flex flex-col items-center gap-1.5 select-none" style={{ width: 100 }}>
      {/* Speech bubble */}
      {fragment && (
        <div
          className="relative max-w-[120px] rounded-xl bg-white border border-stone-200 shadow-sm px-2.5 py-1.5 text-[10px] text-stone-600 leading-snug mb-1"
          style={{ wordBreak: "break-word" }}
        >
          {fragment.slice(0, 60)}{fragment.length > 60 ? "…" : ""}
          <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-r border-b border-stone-200 rotate-45" />
        </div>
      )}

      {/* Disc */}
      <div
        ref={discRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        className="relative w-20 h-20 rounded-full flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
        style={{
          backgroundColor: agent.colour + "26",
          border: `4px ${borderStyle} ${agent.colour}`,
        }}
      >
        <img
          src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(agent.slug)}&size=48`}
          alt={agent.displayName}
          className="w-12 h-12"
        />
        <Led agentStatus={agent.status} taskStatus={taskStatus} />
      </div>

      <span className="text-[13px] font-semibold text-stone-700 text-center leading-tight">
        {agent.displayName}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OperativesFloor({ agents: agentList }: { agents: Agent[] }) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const discPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const discRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Track disc positions for arrow drawing
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      discRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        discPositions.current.set(id, {
          x: r.left - rect.left + r.width / 2,
          y: r.top  - rect.top  + r.height / 2,
        });
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [agentList]);

  const activeTasksByAgent = new Map(
    agentList.map((a) => [a.id, !!a.currentTask]),
  );

  const visible = agentList.filter((a) => a.status !== "deactivated");

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-wrap gap-8 items-center justify-center p-6">
      <DelegationArrows
        agents={agentList}
        positions={discPositions.current}
        activeTasksByAgent={activeTasksByAgent}
      />
      {visible.map((agent) => (
        <AgentDisc
          key={agent.id}
          agent={agent}
          onClick={() => setSelectedAgent(agent)}
          discRef={(el) => {
            if (el) discRefs.current.set(agent.id, el);
            else discRefs.current.delete(agent.id);
          }}
        />
      ))}

      {selectedAgent && (
        <DrillDownPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  );
}

export type { Agent as OperativeAgent };
