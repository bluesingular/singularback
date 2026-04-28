/**
 * ui/src/hooks/useCompanyEvents.ts
 *
 * Connects to GET /api/events/stream (M15 SSE layer) and exposes the
 * live event stream as React state.
 *
 * EventSource auto-reconnects on network drops, so the hook is resilient
 * to transient failures without any extra retry logic.
 *
 * Granular within-task events (agent.reading / agent.analysing / agent.writing)
 * are kept in `liveEvents` — a ring buffer capped at 20 entries.  Task-level
 * events (task.started / task.completed / task.blocked) accumulate in `events`
 * (capped at 50) and are intended for the activity feed.
 */

import { useEffect, useRef, useCallback, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SseEventType =
  | "task.started"
  | "task.completed"
  | "task.blocked"
  | "agent.reading"
  | "agent.analysing"
  | "agent.writing"
  | "keepalive"
  | "connected";

export interface CompanyEvent {
  type:       SseEventType;
  data:       Record<string, unknown>;
  receivedAt: number;
}

export interface UseCompanyEventsReturn {
  /** True while the EventSource is in OPEN state */
  connected:  boolean;
  /** Most recent event of any type */
  lastEvent:  CompanyEvent | null;
  /** Task-level events: started / completed / blocked (ring buffer, max 50) */
  events:     CompanyEvent[];
  /** Within-task granular events (ring buffer, max 20) */
  liveEvents: CompanyEvent[];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const TASK_EVENT_TYPES   = new Set<SseEventType>(["task.started", "task.completed", "task.blocked"]);
const LIVE_EVENT_TYPES   = new Set<SseEventType>(["agent.reading", "agent.analysing", "agent.writing"]);
const MAX_TASK_EVENTS    = 50;
const MAX_LIVE_EVENTS    = 20;

export function useCompanyEvents(): UseCompanyEventsReturn {
  const [connected,  setConnected]  = useState(false);
  const [lastEvent,  setLastEvent]  = useState<CompanyEvent | null>(null);
  const [events,     setEvents]     = useState<CompanyEvent[]>([]);
  const [liveEvents, setLiveEvents] = useState<CompanyEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const handleEvent = useCallback((type: SseEventType, raw: string) => {
    const data: Record<string, unknown> = (() => {
      try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
    })();

    const event: CompanyEvent = { type, data, receivedAt: Date.now() };
    setLastEvent(event);

    if (TASK_EVENT_TYPES.has(type)) {
      setEvents(prev => [event, ...prev].slice(0, MAX_TASK_EVENTS));
    } else if (LIVE_EVENT_TYPES.has(type)) {
      setLiveEvents(prev => [event, ...prev].slice(0, MAX_LIVE_EVENTS));
    }
  }, []);

  useEffect(() => {
    // Guard: skip in SSR / environments without EventSource
    if (typeof EventSource === "undefined") return;

    const es = new EventSource("/api/events/stream");
    esRef.current = es;

    const EVENT_TYPES: SseEventType[] = [
      "task.started", "task.completed", "task.blocked",
      "agent.reading", "agent.analysing", "agent.writing",
      "keepalive",
    ];

    es.addEventListener("connected", () => setConnected(true));

    for (const type of EVENT_TYPES) {
      es.addEventListener(type, (e: Event) => {
        handleEvent(type, (e as MessageEvent).data as string);
      });
    }

    es.onopen  = () => setConnected(true);
    es.onerror = () => setConnected(false); // EventSource will auto-retry

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [handleEvent]);

  return { connected, lastEvent, events, liveEvents };
}
