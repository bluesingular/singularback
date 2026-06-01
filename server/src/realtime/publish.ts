/**
 * server/src/realtime/publish.ts
 *
 * Typed SSE publish helpers — M15.
 *
 * One function per event type. All callers import from here, never from
 * sse.ts directly, to keep payloads consistent across call sites.
 *
 * Event types (per spec §11.2):
 *   Task-level:   task.started | task.completed | task.blocked
 *   Within-task:  agent.reading | agent.analysing | agent.writing | agent.tool_call | agent.reasoning
 *   System:       keepalive (managed by SseManager, not here)
 */

import type { Db } from "@paperclipai/db";
import { taskExecutionEvents } from "@paperclipai/db";
import { sseManager } from "./sse.js";

// ── Task-level events ─────────────────────────────────────────────────────────

export function publishTaskStarted(opts: {
  companyId: string;
  taskId:    string;
  agentId:   string;
  title:     string;
}) {
  sseManager.publishEvent(opts.companyId, {
    type: "task.started",
    data: { taskId: opts.taskId, agentId: opts.agentId, title: opts.title, ts: Date.now() },
  });
}

export function publishTaskCompleted(opts: {
  companyId: string;
  taskId:    string;
  agentId:   string;
  title:     string;
}) {
  sseManager.publishEvent(opts.companyId, {
    type: "task.completed",
    data: { taskId: opts.taskId, agentId: opts.agentId, title: opts.title, ts: Date.now() },
  });
}

export function publishTaskBlocked(opts: {
  companyId: string;
  taskId:    string;
  agentId:   string | null;
  reason:    "pending_approval" | "awaiting_clarification" | "integration_error" | "other";
}) {
  sseManager.publishEvent(opts.companyId, {
    type: "task.blocked",
    data: { taskId: opts.taskId, agentId: opts.agentId, reason: opts.reason, ts: Date.now() },
  });
}

// ── Within-task events ────────────────────────────────────────────────────────

export function publishAgentReading(opts: {
  companyId: string;
  taskId:    string;
  agentId:   string;
  source:    string;   // e.g. "org_memory", "contact_profile", "skill_instructions"
}) {
  sseManager.publishEvent(opts.companyId, {
    type: "agent.reading",
    data: { taskId: opts.taskId, agentId: opts.agentId, source: opts.source, ts: Date.now() },
  });
}

export function publishAgentAnalysing(opts: {
  companyId: string;
  taskId:    string;
  agentId:   string;
  step:      string;   // e.g. "quality_gate", "context_assembly", "self_critique"
}) {
  sseManager.publishEvent(opts.companyId, {
    type: "agent.analysing",
    data: { taskId: opts.taskId, agentId: opts.agentId, step: opts.step, ts: Date.now() },
  });
}

export function publishAgentToolCall(opts: {
  companyId:  string;
  taskId:     string;
  agentId:    string;
  toolName:   string;
  toolCallId: string;
}) {
  sseManager.publishEvent(opts.companyId, {
    type: "agent.tool_call",
    data: {
      taskId: opts.taskId,
      agentId: opts.agentId,
      toolName: opts.toolName,
      toolCallId: opts.toolCallId,
      ts: Date.now(),
    },
  });
}

/**
 * F7 — Reasoning capture.
 *
 * Emits an `agent.reasoning` SSE event (fragment ≤ 120 chars) and persists the
 * full fragment to task_execution_events so the drill-down panel can replay it.
 * Never surfaced in the main UI — operator-request only.
 */
export async function publishAgentReasoning(opts: {
  db:        Db;
  companyId: string;
  taskId:    string;
  agentId:   string;
  fragment:  string;   // truncated to 120 chars before broadcast
}): Promise<void> {
  const fragment = opts.fragment.slice(0, 120);

  sseManager.publishEvent(opts.companyId, {
    type: "agent.reasoning",
    data: { taskId: opts.taskId, agentId: opts.agentId, fragment, ts: Date.now() },
  });

  await opts.db.insert(taskExecutionEvents).values({
    taskId:    opts.taskId,
    companyId: opts.companyId,
    eventType: "reasoning",
    content:   fragment,
  });
}
