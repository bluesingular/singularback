/**
 * M15 — SSE real-time layer (granular events)
 *
 * Tests:
 *  1.  addConnection: registers connection, getConnectionCount returns 1
 *  2.  addConnection: two connections for same company → count=2
 *  3.  addConnection: connections for different companies are isolated
 *  4.  removeConnection: count goes back to 0 after removal
 *  5.  removeConnection: removing non-existent connection is a no-op
 *  6.  publishEvent: event written to all connections for the company
 *  7.  publishEvent: returns count of connections that received event
 *  8.  publishEvent: event NOT sent to connections of different company
 *  9.  publishEvent: returns 0 when no connections for company
 *  10. publishEvent: task.started event delivered correctly
 *  11. publishEvent: agent.reading within-task event delivered correctly
 *  12. publishEvent: agent.analysing event delivered correctly
 *  13. publishEvent: agent.writing event delivered correctly
 *  14. addConnection: starts keepalive timer — write called after KEEPALIVE_INTERVAL_MS
 *  15. inactivity: connection removed after INACTIVITY_TIMEOUT_MS with no events
 *  16. inactivity: publishEvent resets inactivity timer (connection NOT removed on schedule)
 *  17. KEEPALIVE_INTERVAL_MS is 30,000ms
 *  18. INACTIVITY_TIMEOUT_MS is 60,000ms
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  SseManager,
  KEEPALIVE_INTERVAL_MS,
  INACTIVITY_TIMEOUT_MS,
  type SseConnection,
  type SseEvent,
} from "../realtime/sse.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConn(
  companyId: string,
  id = `conn-${Math.random().toString(36).slice(2, 7)}`,
): { conn: SseConnection; writes: SseEvent[] } {
  const writes: SseEvent[] = [];
  const conn: SseConnection = {
    id,
    companyId,
    write:       (event) => writes.push(event),
    lastEventAt: Date.now(),
  };
  return { conn, writes };
}

/**
 * Make an SseManager with fake timers injected so tests control time.
 * Returns the manager + a function to "tick" the clock by N ms.
 */
function makeManager() {
  // Use vitest fake timers — but we inject them manually into SseManager
  // so it doesn't depend on global timer replacement.
  const setIntervalCalls:  Array<{ fn: () => void; ms: number; handle: number }> = [];
  const setTimeoutCalls:   Array<{ fn: () => void; ms: number; handle: number; cleared: boolean }> = [];
  let handleCounter = 0;

  const fakeSetInterval = (fn: () => void, ms: number) => {
    const handle = ++handleCounter;
    setIntervalCalls.push({ fn, ms, handle });
    return handle as unknown as ReturnType<typeof setInterval>;
  };
  const fakeClearInterval = (h: ReturnType<typeof setInterval>) => {
    const idx = setIntervalCalls.findIndex((c) => c.handle === (h as unknown as number));
    if (idx !== -1) setIntervalCalls.splice(idx, 1);
  };

  const fakeSetTimeout = (fn: () => void, ms: number) => {
    const handle = ++handleCounter;
    setTimeoutCalls.push({ fn, ms, handle, cleared: false });
    return handle as unknown as ReturnType<typeof setTimeout>;
  };
  const fakeClearTimeout = (h: ReturnType<typeof setTimeout>) => {
    const entry = setTimeoutCalls.find((c) => c.handle === (h as unknown as number));
    if (entry) entry.cleared = true;
  };

  const mgr = new SseManager({
    setInterval:   fakeSetInterval  as unknown as typeof setInterval,
    clearInterval: fakeClearInterval as unknown as typeof clearInterval,
    setTimeout:    fakeSetTimeout   as unknown as typeof setTimeout,
    clearTimeout:  fakeClearTimeout as unknown as typeof clearTimeout,
  });

  /** Fire all interval callbacks (simulates clock advancing past KEEPALIVE_INTERVAL_MS) */
  function tickIntervals() {
    for (const { fn } of [...setIntervalCalls]) fn();
  }

  /** Fire all un-cleared timeout callbacks (simulates clock advancing past INACTIVITY_TIMEOUT_MS) */
  function tickTimeouts() {
    for (const entry of [...setTimeoutCalls]) {
      if (!entry.cleared) {
        entry.fn();
        entry.cleared = true;
      }
    }
  }

  return { mgr, setIntervalCalls, setTimeoutCalls, tickIntervals, tickTimeouts };
}

// ── addConnection / removeConnection ─────────────────────────────────────────

describe("addConnection", () => {
  it("1. registers connection → getConnectionCount returns 1", () => {
    const { mgr } = makeManager();
    const { conn } = makeConn("company-1");

    mgr.addConnection(conn);

    expect(mgr.getConnectionCount("company-1")).toBe(1);
  });

  it("2. two connections for same company → count=2", () => {
    const { mgr } = makeManager();
    const { conn: c1 } = makeConn("company-1", "conn-1");
    const { conn: c2 } = makeConn("company-1", "conn-2");

    mgr.addConnection(c1);
    mgr.addConnection(c2);

    expect(mgr.getConnectionCount("company-1")).toBe(2);
  });

  it("3. connections for different companies are isolated", () => {
    const { mgr } = makeManager();
    const { conn: c1 } = makeConn("company-1", "conn-1");
    const { conn: c2 } = makeConn("company-2", "conn-2");

    mgr.addConnection(c1);
    mgr.addConnection(c2);

    expect(mgr.getConnectionCount("company-1")).toBe(1);
    expect(mgr.getConnectionCount("company-2")).toBe(1);
  });
});

describe("removeConnection", () => {
  it("4. count goes back to 0 after removal", () => {
    const { mgr } = makeManager();
    const { conn } = makeConn("company-1", "conn-1");

    mgr.addConnection(conn);
    mgr.removeConnection("company-1", "conn-1");

    expect(mgr.getConnectionCount("company-1")).toBe(0);
  });

  it("5. removing non-existent connection is a no-op", () => {
    const { mgr } = makeManager();

    expect(() => mgr.removeConnection("company-x", "conn-ghost")).not.toThrow();
    expect(mgr.getConnectionCount("company-x")).toBe(0);
  });
});

// ── publishEvent ──────────────────────────────────────────────────────────────

describe("publishEvent", () => {
  it("6. event written to all connections for the company", () => {
    const { mgr } = makeManager();
    const { conn: c1, writes: w1 } = makeConn("company-1", "conn-1");
    const { conn: c2, writes: w2 } = makeConn("company-1", "conn-2");

    mgr.addConnection(c1);
    mgr.addConnection(c2);

    const event: SseEvent = { type: "task.started", data: { taskId: "t1" } };
    mgr.publishEvent("company-1", event);

    expect(w1).toHaveLength(1);
    expect(w1[0]).toEqual(event);
    expect(w2).toHaveLength(1);
    expect(w2[0]).toEqual(event);
  });

  it("7. returns count of connections that received event", () => {
    const { mgr } = makeManager();
    const { conn: c1 } = makeConn("company-1", "conn-1");
    const { conn: c2 } = makeConn("company-1", "conn-2");
    const { conn: c3 } = makeConn("company-1", "conn-3");

    mgr.addConnection(c1);
    mgr.addConnection(c2);
    mgr.addConnection(c3);

    const sent = mgr.publishEvent("company-1", { type: "task.completed", data: {} });

    expect(sent).toBe(3);
  });

  it("8. event NOT sent to connections of different company", () => {
    const { mgr } = makeManager();
    const { conn: c1, writes: w1 } = makeConn("company-1", "conn-1");
    const { conn: c2, writes: w2 } = makeConn("company-2", "conn-2");

    mgr.addConnection(c1);
    mgr.addConnection(c2);

    mgr.publishEvent("company-1", { type: "task.started", data: { taskId: "t1" } });

    expect(w1).toHaveLength(1); // received
    expect(w2).toHaveLength(0); // isolated
  });

  it("9. returns 0 when no connections exist for company", () => {
    const { mgr } = makeManager();

    const sent = mgr.publishEvent("company-ghost", { type: "task.started", data: {} });

    expect(sent).toBe(0);
  });

  it("10. task.started event delivered with correct type", () => {
    const { mgr } = makeManager();
    const { conn, writes } = makeConn("company-1");

    mgr.addConnection(conn);
    mgr.publishEvent("company-1", { type: "task.started", data: { taskId: "t1", agentId: "a1" } });

    expect(writes[0].type).toBe("task.started");
    expect(writes[0].data).toMatchObject({ taskId: "t1", agentId: "a1" });
  });

  it("11. agent.reading within-task event delivered correctly", () => {
    const { mgr } = makeManager();
    const { conn, writes } = makeConn("company-1");

    mgr.addConnection(conn);
    mgr.publishEvent("company-1", { type: "agent.reading", data: { taskId: "t1", source: "email" } });

    expect(writes[0].type).toBe("agent.reading");
    expect(writes[0].data.source).toBe("email");
  });

  it("12. agent.analysing event delivered correctly", () => {
    const { mgr } = makeManager();
    const { conn, writes } = makeConn("company-1");

    mgr.addConnection(conn);
    mgr.publishEvent("company-1", { type: "agent.analysing", data: { taskId: "t1" } });

    expect(writes[0].type).toBe("agent.analysing");
  });

  it("13. agent.writing event delivered correctly", () => {
    const { mgr } = makeManager();
    const { conn, writes } = makeConn("company-1");

    mgr.addConnection(conn);
    mgr.publishEvent("company-1", { type: "agent.writing", data: { taskId: "t1" } });

    expect(writes[0].type).toBe("agent.writing");
  });
});

// ── Keepalive ──────────────────────────────────────────────────────────────────

describe("keepalive", () => {
  it("14. addConnection starts keepalive → write called when interval fires", () => {
    const { mgr, tickIntervals } = makeManager();
    const { conn, writes } = makeConn("company-1");

    mgr.addConnection(conn);
    tickIntervals(); // simulate 30s passing

    // The keepalive event was written
    const keepalive = writes.find((e) => e.type === "keepalive");
    expect(keepalive).toBeDefined();
    expect(keepalive?.type).toBe("keepalive");
  });
});

// ── Inactivity timeout ────────────────────────────────────────────────────────

describe("inactivity timeout", () => {
  it("15. connection removed after INACTIVITY_TIMEOUT_MS with no events", () => {
    const { mgr, tickTimeouts } = makeManager();
    const { conn } = makeConn("company-1", "conn-1");

    mgr.addConnection(conn);
    expect(mgr.getConnectionCount("company-1")).toBe(1);

    tickTimeouts(); // simulate 60s of inactivity

    expect(mgr.getConnectionCount("company-1")).toBe(0);
  });

  it("16. publishEvent resets inactivity timer — previous timer cleared", () => {
    const { mgr, setTimeoutCalls, tickTimeouts } = makeManager();
    const { conn } = makeConn("company-1", "conn-1");

    mgr.addConnection(conn);
    // At this point: 1 setTimeout registered (for inactivity)
    expect(setTimeoutCalls.filter((c) => !c.cleared)).toHaveLength(1);

    // Publish event → old timer cleared, new timer registered
    mgr.publishEvent("company-1", { type: "task.started", data: {} });
    const unclearedAfterPublish = setTimeoutCalls.filter((c) => !c.cleared);

    // The old timeout was cleared; a new one was registered
    expect(unclearedAfterPublish).toHaveLength(1);

    // The connection is still alive (new timer hasn't fired)
    expect(mgr.getConnectionCount("company-1")).toBe(1);
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("17. KEEPALIVE_INTERVAL_MS is 30,000ms", () => {
    expect(KEEPALIVE_INTERVAL_MS).toBe(30_000);
  });

  it("18. INACTIVITY_TIMEOUT_MS is 60,000ms", () => {
    expect(INACTIVITY_TIMEOUT_MS).toBe(60_000);
  });
});
