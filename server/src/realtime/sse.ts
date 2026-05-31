/**
 * server/src/realtime/sse.ts
 *
 * SSE real-time layer — M15.
 *
 * Manages per-company SSE connection pools and event routing.
 *
 * Architecture:
 *   - SseManager holds a Map<companyId, Set<SseConnection>>
 *   - publishEvent() fans out to all connections for a company
 *   - Keepalive ping every KEEPALIVE_INTERVAL_MS (30s) prevents proxy timeouts
 *   - Granular events are cleared from memory after INACTIVITY_TIMEOUT_MS (60s)
 *     of no published events on a connection
 *
 * Event types (per spec):
 *   Task-level:       task.started | task.completed | task.blocked
 *   Within-task:      agent.reading | agent.analysing | agent.writing
 *   System:           keepalive
 *
 * Company isolation: only connections subscribed to a companyId receive
 * its events. Never cross-streams two companies (RULE 8).
 */

export const KEEPALIVE_INTERVAL_MS  = 30_000;  // 30 seconds
export const INACTIVITY_TIMEOUT_MS  = 60_000;  // 60 seconds

// ── Types ─────────────────────────────────────────────────────────────────────

export type SseEventType =
  | "task.started"
  | "task.completed"
  | "task.blocked"
  | "agent.reading"
  | "agent.analysing"
  | "agent.writing"
  | "agent.tool_call"
  | "keepalive";

export interface SseEvent {
  type: SseEventType;
  data: Record<string, unknown>;
}

export interface SseConnection {
  /** Unique connection identifier (e.g. UUID) */
  id:        string;
  companyId: string;
  /** Write an SSE frame to the HTTP response stream */
  write:     (event: SseEvent) => void;
  /** Timestamp of the last event published to this connection */
  lastEventAt: number;
}

// ── SseManager ────────────────────────────────────────────────────────────────

export class SseManager {
  private readonly connections = new Map<string, Set<SseConnection>>();

  /** Keepalive timer handles per connection, keyed by connection id */
  private readonly keepaliveTimers  = new Map<string, ReturnType<typeof setInterval>>();
  /** Inactivity cleanup timer handles per connection, keyed by connection id */
  private readonly inactivityTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Injectable timer factories for testing
  private readonly _setInterval: typeof setInterval;
  private readonly _clearInterval: typeof clearInterval;
  private readonly _setTimeout: typeof setTimeout;
  private readonly _clearTimeout: typeof clearTimeout;

  constructor(timers?: {
    setInterval?:   typeof setInterval;
    clearInterval?: typeof clearInterval;
    setTimeout?:    typeof setTimeout;
    clearTimeout?:  typeof clearTimeout;
  }) {
    this._setInterval   = timers?.setInterval   ?? setInterval;
    this._clearInterval = timers?.clearInterval ?? clearInterval;
    this._setTimeout    = timers?.setTimeout    ?? setTimeout;
    this._clearTimeout  = timers?.clearTimeout  ?? clearTimeout;
  }

  // ── Connection lifecycle ───────────────────────────────────────────────────

  /**
   * Register a new SSE connection for a company.
   * Starts the keepalive timer for this connection immediately.
   */
  addConnection(conn: SseConnection): void {
    if (!this.connections.has(conn.companyId)) {
      this.connections.set(conn.companyId, new Set());
    }
    this.connections.get(conn.companyId)!.add(conn);

    // Start keepalive
    const keepaliveHandle = this._setInterval(() => {
      conn.write({ type: "keepalive", data: { ts: Date.now() } });
    }, KEEPALIVE_INTERVAL_MS);
    this.keepaliveTimers.set(conn.id, keepaliveHandle);

    // Start inactivity timeout
    this._resetInactivityTimer(conn);
  }

  /**
   * Deregister a connection (called on client disconnect or timeout).
   * Clears all timers for the connection.
   */
  removeConnection(companyId: string, connId: string): void {
    const set = this.connections.get(companyId);
    if (!set) return;

    for (const conn of set) {
      if (conn.id === connId) {
        set.delete(conn);
        break;
      }
    }
    if (set.size === 0) {
      this.connections.delete(companyId);
    }

    const keepalive = this.keepaliveTimers.get(connId);
    if (keepalive !== undefined) {
      this._clearInterval(keepalive);
      this.keepaliveTimers.delete(connId);
    }

    const inactivity = this.inactivityTimers.get(connId);
    if (inactivity !== undefined) {
      this._clearTimeout(inactivity);
      this.inactivityTimers.delete(connId);
    }
  }

  // ── Event publishing ───────────────────────────────────────────────────────

  /**
   * Publish an event to all active connections for a company.
   *
   * @returns Number of connections that received the event.
   */
  publishEvent(companyId: string, event: SseEvent): number {
    const set = this.connections.get(companyId);
    if (!set || set.size === 0) return 0;

    let sent = 0;
    for (const conn of set) {
      conn.write(event);
      conn.lastEventAt = Date.now();
      this._resetInactivityTimer(conn);
      sent++;
    }
    return sent;
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  getConnectionCount(companyId: string): number {
    return this.connections.get(companyId)?.size ?? 0;
  }

  getTotalConnectionCount(): number {
    let total = 0;
    for (const set of this.connections.values()) total += set.size;
    return total;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private _resetInactivityTimer(conn: SseConnection): void {
    const existing = this.inactivityTimers.get(conn.id);
    if (existing !== undefined) this._clearTimeout(existing);

    const handle = this._setTimeout(() => {
      this.removeConnection(conn.companyId, conn.id);
    }, INACTIVITY_TIMEOUT_MS);

    this.inactivityTimers.set(conn.id, handle);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

/** Global SSE manager — one per server process */
export const sseManager = new SseManager();
