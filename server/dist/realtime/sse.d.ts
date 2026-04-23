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
export declare const KEEPALIVE_INTERVAL_MS = 30000;
export declare const INACTIVITY_TIMEOUT_MS = 60000;
export type SseEventType = "task.started" | "task.completed" | "task.blocked" | "agent.reading" | "agent.analysing" | "agent.writing" | "keepalive";
export interface SseEvent {
    type: SseEventType;
    data: Record<string, unknown>;
}
export interface SseConnection {
    /** Unique connection identifier (e.g. UUID) */
    id: string;
    companyId: string;
    /** Write an SSE frame to the HTTP response stream */
    write: (event: SseEvent) => void;
    /** Timestamp of the last event published to this connection */
    lastEventAt: number;
}
export declare class SseManager {
    private readonly connections;
    /** Keepalive timer handles per connection, keyed by connection id */
    private readonly keepaliveTimers;
    /** Inactivity cleanup timer handles per connection, keyed by connection id */
    private readonly inactivityTimers;
    private readonly _setInterval;
    private readonly _clearInterval;
    private readonly _setTimeout;
    private readonly _clearTimeout;
    constructor(timers?: {
        setInterval?: typeof setInterval;
        clearInterval?: typeof clearInterval;
        setTimeout?: typeof setTimeout;
        clearTimeout?: typeof clearTimeout;
    });
    /**
     * Register a new SSE connection for a company.
     * Starts the keepalive timer for this connection immediately.
     */
    addConnection(conn: SseConnection): void;
    /**
     * Deregister a connection (called on client disconnect or timeout).
     * Clears all timers for the connection.
     */
    removeConnection(companyId: string, connId: string): void;
    /**
     * Publish an event to all active connections for a company.
     *
     * @returns Number of connections that received the event.
     */
    publishEvent(companyId: string, event: SseEvent): number;
    getConnectionCount(companyId: string): number;
    getTotalConnectionCount(): number;
    private _resetInactivityTimer;
}
/** Global SSE manager — one per server process */
export declare const sseManager: SseManager;
//# sourceMappingURL=sse.d.ts.map