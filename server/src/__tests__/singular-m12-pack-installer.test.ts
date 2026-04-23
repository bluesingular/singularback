/**
 * M12 — Pack installer + seed tasks
 *
 * Tests:
 *  1.  validatePackManifest: valid manifest → no error
 *  2.  validatePackManifest: missing slug → PackValidationError
 *  3.  validatePackManifest: wrong activationSequence count (≠5) → error
 *  4.  validatePackManifest: empty agents array → error
 *  5.  interpolateTemplate: replaces {{company_name}} with value
 *  6.  interpolateTemplate: unknown var → leaves {{unknown}} unchanged
 *  7.  interpolateTemplate: multiple vars replaced in one pass
 *  8.  installPack: all steps succeed → success=true, agentIds returned
 *  9.  installPack: step 4 (quality gates) throws → PackInstallError; seed tasks NOT scheduled
 * 10.  installPack: step 2 (agents) throws → PackInstallError; seed tasks NOT scheduled
 * 11.  installPack: seed task delay capped at 600,000ms (10 min)
 * 12.  installPack: all 3 seed tasks scheduled in agentQueue
 * 13.  installPack: template vars interpolated in seed task title and body
 * 14.  installPack: all 5 activation triggers registered in systemQueue
 * 15.  installPack: activation trigger jobIds are idempotent (company+pack+key)
 * 16.  SEED_TASK_MAX_DELAY_MS is exactly 600,000
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  validatePackManifest,
  installPack,
  SEED_TASK_MAX_DELAY_MS,
} from "../packs/installer.js";

import {
  interpolateTemplate,
} from "../packs/template.js";

import {
  PackValidationError,
  PackInstallError,
  type PackManifest,
} from "../packs/types.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePack(overrides: Partial<PackManifest> = {}): PackManifest {
  return {
    slug:    "p1-recruitment",
    name:    "Recrutement",
    version: "1.0.0",
    agents: [
      { slug: "sophie", name: "Sophie", description: "Sourcing agent", modelTier: "T1_FR", skills: ["qualification-cv"] },
    ],
    skills: [
      { slug: "qualification-cv", name: "Qualification CV", markdown: "# Skill for {{company_name}}", tier: 1, gdprRequired: true },
    ],
    qualityGates: [
      { gateType: "volume_limit", config: { maxPerDay: 50 }, enabled: true },
    ],
    seedTasks: [
      { agentSlug: "sophie", title: "Qualifier le CV de {{candidate_name}}", body: "Voici le CV reçu chez {{company_name}}.", delayMs: 0 },
      { agentSlug: "sophie", title: "Préparer rapport hebdo", body: "Rapport semaine 1.", delayMs: 60_000 },
      { agentSlug: "sophie", title: "Analyser marché", body: "Analyse du marché {{sector}}.", delayMs: 0 },
    ],
    activationSequence: [
      { key: "day_0_seed",        dayThreshold: 0, notificationTitle: "Démarrage",     notificationBody: "Vos agents commencent." },
      { key: "day_2_first_task",  dayThreshold: 2, notificationTitle: "Premier résultat", notificationBody: "Premier travail accompli." },
      { key: "day_4_milestone",   dayThreshold: 4, notificationTitle: "Rythme de croisière", notificationBody: "5 tâches complètes." },
      { key: "day_6_relationship",dayThreshold: 6, notificationTitle: "Premier contact",  notificationBody: "Votre équipe engage." },
      { key: "day_7_summary",     dayThreshold: 7, notificationTitle: "Bilan semaine 1",  notificationBody: "Voici ce qui a été accompli." },
    ],
    companyDna: { tone: "Professionnel et bienveillant" },
    ...overrides,
  };
}

const DEFAULT_VARS = {
  company_name:    "Agence Dupont RH",
  candidate_name:  "Jean Martin",
  sector:          "IT",
};

// ── DB mock builder ───────────────────────────────────────────────────────────

function makeInstallDb(opts: {
  /** Which values() call should throw (1=agents, 2=skills, 3=gates, 4=dna) */
  throwAtStep?: number;
} = {}) {
  let stepCount = 0;

  const insertValues = vi.fn().mockImplementation(() => {
    stepCount++;
    if (opts.throwAtStep === stepCount) {
      throw new Error(`Simulated failure at step ${stepCount}`);
    }
    const rowId = `agent-${stepCount}`;
    // Return plain object (not thenable) so `await values()` resolves immediately.
    // Callers that chain .returning() get a proper Promise from that method.
    return {
      returning:          vi.fn().mockResolvedValue([{ id: rowId }]),
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    };
  });

  const tx = {
    insert: vi.fn().mockReturnValue({ values: insertValues }),
  };

  const db = {
    transaction: vi.fn().mockImplementation(async (callback: (tx: typeof tx) => Promise<unknown>) => {
      stepCount = 0;
      return callback(tx);
    }),
  } as any;

  return { db, tx, insertValues };
}

function makeQueues() {
  const agentQueue  = { add: vi.fn().mockResolvedValue({ id: "job-1" }) };
  const systemQueue = { add: vi.fn().mockResolvedValue({ id: "job-2" }) };
  return { agentQueue, systemQueue };
}

// ── validatePackManifest ──────────────────────────────────────────────────────

describe("validatePackManifest", () => {
  it("1. valid manifest → no error", () => {
    expect(() => validatePackManifest(makePack())).not.toThrow();
  });

  it("2. missing slug → PackValidationError", () => {
    const pack = makePack({ slug: undefined as unknown as string });
    expect(() => validatePackManifest(pack)).toThrow(PackValidationError);
    expect(() => validatePackManifest(pack)).toThrow(/slug/);
  });

  it("3. activationSequence with ≠5 entries → error", () => {
    const pack = makePack({ activationSequence: [] });
    expect(() => validatePackManifest(pack)).toThrow(PackValidationError);
    expect(() => validatePackManifest(pack)).toThrow(/5/);
  });

  it("4. empty agents array → error", () => {
    const pack = makePack({ agents: [] });
    expect(() => validatePackManifest(pack)).toThrow(PackValidationError);
    expect(() => validatePackManifest(pack)).toThrow(/agent/i);
  });
});

// ── interpolateTemplate ───────────────────────────────────────────────────────

describe("interpolateTemplate", () => {
  it("5. replaces {{company_name}}", () => {
    const result = interpolateTemplate("Bonjour {{company_name}} !", { company_name: "Agence Dupont" });
    expect(result).toBe("Bonjour Agence Dupont !");
  });

  it("6. unknown var → leaves {{unknown}} unchanged", () => {
    const result = interpolateTemplate("Valeur: {{unknown_var}}", {});
    expect(result).toBe("Valeur: {{unknown_var}}");
  });

  it("7. multiple vars replaced in one pass", () => {
    const result = interpolateTemplate(
      "{{greeting}} {{name}}, bienvenue chez {{company}}.",
      { greeting: "Bonjour", name: "Marie", company: "TechCorp" },
    );
    expect(result).toBe("Bonjour Marie, bienvenue chez TechCorp.");
  });
});

// ── installPack ───────────────────────────────────────────────────────────────

describe("installPack", () => {
  beforeEach(() => vi.clearAllMocks());

  it("8. all steps succeed → success=true, agentIds returned", async () => {
    const { db } = makeInstallDb();
    const { agentQueue, systemQueue } = makeQueues();

    const result = await installPack(db, {
      companyId: "company-1",
      pack:      makePack(),
      variables: DEFAULT_VARS,
      agentQueue,
      systemQueue,
    });

    expect(result.success).toBe(true);
    expect(result.packSlug).toBe("p1-recruitment");
    expect(Array.isArray(result.agentIds)).toBe(true);
  });

  it("9. step 4 (quality gates) throws → PackInstallError; seed tasks NOT scheduled", async () => {
    // Steps in the transaction:
    //   insert#1 = agents (step 2, has .returning())
    //   insert#2 = skills (step 3, no .returning())
    //   insert#3 = quality gates (step 4) ← throw here
    const { db } = makeInstallDb({ throwAtStep: 3 }); // 3rd insert call
    const { agentQueue, systemQueue } = makeQueues();

    await expect(
      installPack(db, {
        companyId: "company-1",
        pack:      makePack(),
        variables: DEFAULT_VARS,
        agentQueue,
        systemQueue,
      }),
    ).rejects.toThrow(PackInstallError);

    // Steps 6-7 must NOT have been called
    expect(agentQueue.add).not.toHaveBeenCalled();
    expect(systemQueue.add).not.toHaveBeenCalled();
  });

  it("10. step 2 (agents) throws → PackInstallError; seed tasks NOT scheduled", async () => {
    const { db } = makeInstallDb({ throwAtStep: 1 }); // 1st insert call (agents)
    const { agentQueue, systemQueue } = makeQueues();

    await expect(
      installPack(db, {
        companyId: "company-1",
        pack:      makePack(),
        variables: DEFAULT_VARS,
        agentQueue,
        systemQueue,
      }),
    ).rejects.toThrow(PackInstallError);

    expect(agentQueue.add).not.toHaveBeenCalled();
    expect(systemQueue.add).not.toHaveBeenCalled();
  });

  it("11. seed task delay capped at SEED_TASK_MAX_DELAY_MS (600,000ms)", async () => {
    const { db } = makeInstallDb();
    const { agentQueue, systemQueue } = makeQueues();

    const packWithLongDelay = makePack({
      seedTasks: [
        { agentSlug: "sophie", title: "Task 1", body: "Body 1", delayMs: 99_999_999 }, // way over limit
        { agentSlug: "sophie", title: "Task 2", body: "Body 2", delayMs: 0 },
        { agentSlug: "sophie", title: "Task 3", body: "Body 3", delayMs: 300_000 },
      ],
    });

    await installPack(db, {
      companyId: "company-1",
      pack:      packWithLongDelay,
      variables: DEFAULT_VARS,
      agentQueue,
      systemQueue,
    });

    const delays = agentQueue.add.mock.calls.map((c: unknown[]) => (c[2] as { delay?: number })?.delay ?? 0);
    expect(Math.max(...delays)).toBeLessThanOrEqual(SEED_TASK_MAX_DELAY_MS);
  });

  it("12. all 3 seed tasks scheduled in agentQueue", async () => {
    const { db } = makeInstallDb();
    const { agentQueue, systemQueue } = makeQueues();

    await installPack(db, {
      companyId: "company-1",
      pack:      makePack(),
      variables: DEFAULT_VARS,
      agentQueue,
      systemQueue,
    });

    expect(agentQueue.add).toHaveBeenCalledTimes(3);
    for (const call of agentQueue.add.mock.calls) {
      expect(call[0]).toBe("seed.task");
    }
  });

  it("13. template vars interpolated in seed task title and body", async () => {
    const { db } = makeInstallDb();
    const { agentQueue, systemQueue } = makeQueues();

    await installPack(db, {
      companyId: "company-1",
      pack:      makePack(),
      variables: DEFAULT_VARS,
      agentQueue,
      systemQueue,
    });

    // First seed task: title has {{candidate_name}}, body has {{company_name}}
    const firstCall = agentQueue.add.mock.calls[0];
    const data = firstCall[1] as { title: string; body: string };

    expect(data.title).toContain("Jean Martin");         // {{candidate_name}} resolved
    expect(data.title).not.toContain("{{");              // no raw placeholders left
    expect(data.body).toContain("Agence Dupont RH");     // {{company_name}} resolved
  });

  it("14. all 5 activation triggers registered in systemQueue", async () => {
    const { db } = makeInstallDb();
    const { agentQueue, systemQueue } = makeQueues();

    await installPack(db, {
      companyId: "company-1",
      pack:      makePack(),
      variables: DEFAULT_VARS,
      agentQueue,
      systemQueue,
    });

    expect(systemQueue.add).toHaveBeenCalledTimes(5);
    for (const call of systemQueue.add.mock.calls) {
      expect(call[0]).toBe("activation.check");
    }
  });

  it("15. activation trigger jobIds include company+pack+key (idempotent)", async () => {
    const { db } = makeInstallDb();
    const { agentQueue, systemQueue } = makeQueues();

    await installPack(db, {
      companyId: "company-1",
      pack:      makePack(),
      variables: DEFAULT_VARS,
      agentQueue,
      systemQueue,
    });

    const jobIds = systemQueue.add.mock.calls.map(
      (c: unknown[]) => (c[2] as { jobId?: string })?.jobId,
    );

    // All job IDs unique and contain the trigger key
    const uniqueIds = new Set(jobIds);
    expect(uniqueIds.size).toBe(5);
    expect(jobIds[0]).toContain("company-1");
    expect(jobIds[0]).toContain("p1-recruitment");
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("16. SEED_TASK_MAX_DELAY_MS is 600,000 (10 minutes)", () => {
    expect(SEED_TASK_MAX_DELAY_MS).toBe(600_000);
  });
});
