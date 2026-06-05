/**
 * M1 — BullMQ EDA: queue infrastructure tests
 *
 * Tests:
 *  1. emit.heartbeat — enqueues with correct jobId and delay
 *  2. emit.heartbeat — deduplication: same agentId → same jobId
 *  3. emit.emailReceived — enqueues with correct priority and jobId
 *  4. emit.taskApproved — enqueues with correct priority and jobId
 *  5. emit.webhookReceived — enqueues on agents queue
 *  6. emit.extractMemory — enqueues on background queue
 *  7. emit.improveSkill — enqueues with dedup jobId
 *  8. emit.scheduleMonthlyReset — enqueues on system queue with repeat
 *  9. bootstrapScheduler — seeds heartbeat jobs for active agents
 * 10. bootstrapScheduler — skips paused agents
 * 11. bootstrapScheduler — skips agents with heartbeat disabled
 * 12. bootstrapScheduler — skips agents that already have a pending job
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock BullMQ ───────────────────────────────────────────────────────────────

const mockAgentQueueAdd = vi.fn().mockResolvedValue({ id: "job-1" });
const mockBackgroundQueueAdd = vi.fn().mockResolvedValue({ id: "job-2" });
const mockSystemQueueAdd = vi.fn().mockResolvedValue({ id: "job-3" });
const mockAgentQueueGetJob = vi.fn();

vi.mock("../queue/queues.js", () => ({
  agentQueue: {
    add: mockAgentQueueAdd,
    getJob: mockAgentQueueGetJob,
    close: vi.fn().mockResolvedValue(undefined),
  },
  heartbeatQueue: {
    add: mockAgentQueueAdd,
    getJob: mockAgentQueueGetJob,
    close: vi.fn().mockResolvedValue(undefined),
  },
  backgroundQueue: {
    add: mockBackgroundQueueAdd,
    close: vi.fn().mockResolvedValue(undefined),
  },
  systemQueue: {
    add: mockSystemQueueAdd,
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Mock Redis (not needed in unit tests) ────────────────────────────────────

vi.mock("../queue/redis.js", () => ({
  redisConnection: {},
  redisConnectionBlocking: {},
}));

// ── Test data ─────────────────────────────────────────────────────────────────

const agentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const companyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const agentId2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const taskId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const userId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("emit.heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. enqueues on agents queue with correct jobId and delay", async () => {
    const { emit } = await import("../queue/emit.js");

    await emit.heartbeat({ agentId, companyId, triggeredBy: "scheduler" }, 5000);

    expect(mockAgentQueueAdd).toHaveBeenCalledOnce();
    const [name, data, opts] = mockAgentQueueAdd.mock.calls[0];
    expect(name).toBe("heartbeat");
    expect(data).toMatchObject({ agentId, companyId, triggeredBy: "scheduler" });
    expect(opts.jobId).toBe(`heartbeat:${agentId}`);
    expect(opts.delay).toBe(5000);
  });

  it("2. jobId is always heartbeat:{agentId} (deduplication key)", async () => {
    const { emit } = await import("../queue/emit.js");

    await emit.heartbeat({ agentId, companyId, triggeredBy: "manual" }, 0);
    await emit.heartbeat({ agentId, companyId, triggeredBy: "email" }, 1000);

    const calls = mockAgentQueueAdd.mock.calls;
    expect(calls[0][2].jobId).toBe(`heartbeat:${agentId}`);
    expect(calls[1][2].jobId).toBe(`heartbeat:${agentId}`);
  });
});

describe("emit.emailReceived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("3. enqueues on agents queue with priority=10 and dedup jobId", async () => {
    const { emit } = await import("../queue/emit.js");

    await emit.emailReceived({
      agentId,
      companyId,
      emailId: "msg-xyz",
      threadId: "thread-1",
      from: "candidate@example.com",
      subject: "Candidature spontanée",
      bodyPreview: "Bonjour, je me permets...",
    });

    expect(mockAgentQueueAdd).toHaveBeenCalledOnce();
    const [name, , opts] = mockAgentQueueAdd.mock.calls[0];
    expect(name).toBe("email.received");
    expect(opts.priority).toBe(10);
    expect(opts.jobId).toBe("email:msg-xyz");
  });
});

describe("emit.taskApproved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("4. enqueues on agents queue with priority=10 and dedup jobId", async () => {
    const { emit } = await import("../queue/emit.js");

    await emit.taskApproved({ taskId, agentId, companyId, approvedBy: userId });

    expect(mockAgentQueueAdd).toHaveBeenCalledOnce();
    const [name, , opts] = mockAgentQueueAdd.mock.calls[0];
    expect(name).toBe("task.approved");
    expect(opts.priority).toBe(10);
    expect(opts.jobId).toBe(`approval:${taskId}`);
  });
});

describe("emit.webhookReceived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("5. enqueues on agents queue with priority=5", async () => {
    const { emit } = await import("../queue/emit.js");

    await emit.webhookReceived({
      agentId,
      companyId,
      source: "indeed",
      payload: { candidateId: "123" },
      receivedAt: new Date().toISOString(),
    });

    expect(mockAgentQueueAdd).toHaveBeenCalledOnce();
    const [name, , opts] = mockAgentQueueAdd.mock.calls[0];
    expect(name).toBe("webhook.received");
    expect(opts.priority).toBe(5);
  });
});

describe("emit.extractMemory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("6. enqueues on background queue", async () => {
    const { emit } = await import("../queue/emit.js");

    await emit.extractMemory({
      taskId,
      agentId,
      companyId,
      output: "L'entretien s'est bien passé.",
    });

    expect(mockBackgroundQueueAdd).toHaveBeenCalledOnce();
    const [name] = mockBackgroundQueueAdd.mock.calls[0];
    expect(name).toBe("memory.extract");
  });
});

describe("emit.improveSkill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("7. enqueues on background queue with per-agent-skill dedup jobId", async () => {
    const { emit } = await import("../queue/emit.js");

    await emit.improveSkill({
      agentId,
      companyId,
      skillSlug: "qualification-cv",
      triggerReason: "quality_degradation",
    });

    expect(mockBackgroundQueueAdd).toHaveBeenCalledOnce();
    const [name, , opts] = mockBackgroundQueueAdd.mock.calls[0];
    expect(name).toBe("skill.improve");
    expect(opts.jobId).toBe(`skill-improve:${agentId}:qualification-cv`);
  });
});

describe("emit.scheduleMonthlyReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("8. enqueues on system queue with monthly repeat pattern", async () => {
    const { emit } = await import("../queue/emit.js");

    await emit.scheduleMonthlyReset(companyId);

    expect(mockSystemQueueAdd).toHaveBeenCalledOnce();
    const [name, data, opts] = mockSystemQueueAdd.mock.calls[0];
    expect(name).toBe("cost.reset");
    expect(data).toMatchObject({ companyId });
    expect(opts.repeat?.pattern).toBe("0 0 1 * *");
    expect(opts.jobId).toBe(`cost-reset:${companyId}`);
  });
});

describe("bootstrapScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeDb(opts: {
    companies?: unknown[];
    agents?: unknown[];
    existingJob?: unknown | null;
  }) {
    let selectCall = 0;
    const companyResults = opts.companies ?? [{ id: companyId }];
    const agentResults = opts.agents ?? [];

    return {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          selectCall++;
          const result = selectCall === 1 ? companyResults : agentResults;
          return Promise.resolve(result);
        }),
      })),
    };
  }

  it("9. seeds heartbeat jobs for active agents without existing jobs", async () => {
    mockAgentQueueGetJob.mockResolvedValue(null); // no existing job
    const { emit } = await import("../queue/emit.js");
    const { bootstrapScheduler } = await import("../queue/scheduler.js");

    const db = makeDb({
      agents: [
        {
          id: agentId,
          companyId,
          status: "active",
          runtimeConfig: { heartbeat: { enabled: true, intervalSec: 30 } },
        },
        {
          id: agentId2,
          companyId,
          status: "active",
          runtimeConfig: { heartbeat: { enabled: true, intervalSec: 60 } },
        },
      ],
    });

    await bootstrapScheduler(db as any);

    // Two heartbeat jobs seeded + monthly resets
    const heartbeatCalls = mockAgentQueueAdd.mock.calls.filter(
      ([name]) => name === "heartbeat",
    );
    expect(heartbeatCalls).toHaveLength(2);
    expect(heartbeatCalls[0][2].delay).toBe(0); // run immediately
  });

  it("10. skips paused agents", async () => {
    mockAgentQueueGetJob.mockResolvedValue(null);
    const { bootstrapScheduler } = await import("../queue/scheduler.js");

    const db = makeDb({
      agents: [
        {
          id: agentId,
          companyId,
          status: "paused",
          runtimeConfig: { heartbeat: { enabled: true, intervalSec: 30 } },
        },
      ],
    });

    await bootstrapScheduler(db as any);

    const heartbeatCalls = mockAgentQueueAdd.mock.calls.filter(
      ([name]) => name === "heartbeat",
    );
    expect(heartbeatCalls).toHaveLength(0);
  });

  it("11. skips agents with heartbeat disabled or intervalSec=0", async () => {
    mockAgentQueueGetJob.mockResolvedValue(null);
    const { bootstrapScheduler } = await import("../queue/scheduler.js");

    const db = makeDb({
      agents: [
        {
          id: agentId,
          companyId,
          status: "active",
          runtimeConfig: { heartbeat: { enabled: false, intervalSec: 30 } },
        },
        {
          id: agentId2,
          companyId,
          status: "active",
          runtimeConfig: { heartbeat: { enabled: true, intervalSec: 0 } },
        },
      ],
    });

    await bootstrapScheduler(db as any);

    const heartbeatCalls = mockAgentQueueAdd.mock.calls.filter(
      ([name]) => name === "heartbeat",
    );
    expect(heartbeatCalls).toHaveLength(0);
  });

  it("12. skips agents that already have a pending BullMQ heartbeat job", async () => {
    // Simulate an existing job for agentId, no job for agentId2
    mockAgentQueueGetJob.mockImplementation(async (jobId: string) => {
      if (jobId === `heartbeat:${agentId}`) return { id: jobId }; // exists
      return null;
    });

    const { bootstrapScheduler } = await import("../queue/scheduler.js");

    const db = makeDb({
      agents: [
        {
          id: agentId,
          companyId,
          status: "active",
          runtimeConfig: { heartbeat: { enabled: true, intervalSec: 30 } },
        },
        {
          id: agentId2,
          companyId,
          status: "active",
          runtimeConfig: { heartbeat: { enabled: true, intervalSec: 30 } },
        },
      ],
    });

    await bootstrapScheduler(db as any);

    const heartbeatCalls = mockAgentQueueAdd.mock.calls.filter(
      ([name]) => name === "heartbeat",
    );
    // Only agentId2 should be seeded (agentId already has a job)
    expect(heartbeatCalls).toHaveLength(1);
    expect(heartbeatCalls[0][1].agentId).toBe(agentId2);
  });
});
