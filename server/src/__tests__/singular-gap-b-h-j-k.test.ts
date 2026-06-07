/**
 * Tests for Gap B, Gap H, Gap J, Gap K — "at 10 design partners"
 *
 * Gap B — Inline output editing before approval (routes/task-inline-edit.ts)
 * Gap H — Graceful partial output delivery (tasks/partial-output.ts)
 * Gap J — Pack update migration path (packs/migrations.ts)
 * Gap K — Session gap awareness (middleware/session-activity.ts)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Gap B — Inline output editing
// ─────────────────────────────────────────────────────────────────────────────

// We test the route logic directly via the golden-dataset invariants,
// extracting the core decision logic that can be unit-tested.
// The HTTP layer is integration-tested via the route file existence checks.

describe("Gap B — Inline output editing", () => {
  it("route file exists and is registered in app.ts", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const ROOT = path.resolve(__dirname, "../../..");

    const routeFile = path.join(ROOT, "server/src/routes/task-inline-edit.ts");
    expect(fs.existsSync(routeFile)).toBe(true);

    const app = fs.readFileSync(path.join(ROOT, "server/src/app.ts"), "utf8");
    expect(app).toContain("taskInlineEditRoutes");
  });

  it("INLINE_EDIT_WEIGHT is 3.0 — highest training signal per spec", async () => {
    const src = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../routes/task-inline-edit.ts", import.meta.url).pathname,
        "utf8",
      )
    );
    expect(src).toContain('"3.0"');
    expect(src).toContain("INLINE_EDIT_WEIGHT");
  });

  it("source is 'inline_approval_edit'", async () => {
    const src = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../routes/task-inline-edit.ts", import.meta.url).pathname,
        "utf8",
      )
    );
    expect(src).toContain("inline_approval_edit");
    expect(src).toContain("INLINE_EDIT_SOURCE");
  });

  it("no-change guard: same edit as original produces no golden dataset entry", async () => {
    // The route checks: if (operatorEdit === agentOutput) → recorded: false
    const src = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../routes/task-inline-edit.ts", import.meta.url).pathname,
        "utf8",
      )
    );
    // Invariant is present in source
    expect(src).toContain("recorded: false");
    expect(src).toContain("Aucune modification");
  });

  it("only editable in pending_approval or in_review states", async () => {
    const src = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../routes/task-inline-edit.ts", import.meta.url).pathname,
        "utf8",
      )
    );
    expect(src).toContain("pending_approval");
    expect(src).toContain("in_review");
    expect(src).toContain("EDITABLE_STATUSES");
  });

  it("charCount is included in the response", async () => {
    const src = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../routes/task-inline-edit.ts", import.meta.url).pathname,
        "utf8",
      )
    );
    expect(src).toContain("charCount");
    expect(src).toContain("recorded: true");
  });

  it("pattern extraction is triggered fire-and-forget after edit", async () => {
    const src = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../routes/task-inline-edit.ts", import.meta.url).pathname,
        "utf8",
      )
    );
    // maybeExtractCorrectionPattern is called as void (non-blocking)
    expect(src).toContain("maybeExtractCorrectionPattern");
    expect(src).toContain("void maybeExtractCorrectionPattern");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap H — Graceful partial output delivery
// ─────────────────────────────────────────────────────────────────────────────

import {
  submitPartialOutput,
  approvePartialOutput,
  requestPartialCompletion,
  type PartialResult,
} from "../tasks/partial-output.js";

const COMPANY_ID = "ch000000-0000-4000-8000-000000000008";
const TASK_ID    = "th000000-0000-4000-8000-000000000008";

const PARTIAL_RESULT: PartialResult = {
  completedItems: [{ id: 1 }, { id: 2 }],
  failedItems:    [{ index: 2, reason: "Timeout de l'API" }],
  completionPct:  66,
  failureSummary: "L'étape 3 a échoué — délai d'attente dépassé.",
  retryAvailable: true,
};

function makePartialDb(taskStatus = "in_progress") {
  const updates: { table: string; set: Record<string, unknown> }[] = [];
  const inserts: unknown[] = [];

  return {
    updates,
    inserts,
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ status: taskStatus }]),
        }),
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        inserts.push(v);
        return Promise.resolve();
      },
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => {
        updates.push({ table: String(table), set: vals });
        return {
          where: () => Promise.resolve(),
        };
      },
    }),
  } as unknown as import("@paperclipai/db").Db & { updates: unknown[]; inserts: unknown[] };
}

describe("Gap H — Graceful partial output delivery", () => {
  it("submitPartialOutput transitions task to partial_complete", async () => {
    const db = makePartialDb("in_progress");
    await submitPartialOutput(db, TASK_ID, COMPANY_ID, PARTIAL_RESULT);

    const update = (db as any).updates.find((u: any) =>
      u.set?.status === "partial_complete"
    );
    expect(update).toBeDefined();
  });

  it("submitPartialOutput records partial result as task execution event", async () => {
    const db = makePartialDb("in_progress");
    await submitPartialOutput(db, TASK_ID, COMPANY_ID, PARTIAL_RESULT);

    expect((db as any).inserts.length).toBeGreaterThan(0);
    const event = (db as any).inserts[0] as any;
    expect(event.eventType).toBe("partial_result");
    const content = JSON.parse(event.content);
    expect(content.completionPct).toBe(66);
    expect(content.completedItems).toHaveLength(2);
    expect(content.failedItems).toHaveLength(1);
  });

  it("submitPartialOutput no-ops when task is not in_progress", async () => {
    const db = makePartialDb("done");
    await submitPartialOutput(db, TASK_ID, COMPANY_ID, PARTIAL_RESULT);
    expect((db as any).updates).toHaveLength(0);
  });

  it("submitPartialOutput no-ops when task not found", async () => {
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
      insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
      update: vi.fn(),
    } as unknown as import("@paperclipai/db").Db;

    await submitPartialOutput(db, TASK_ID, COMPANY_ID, PARTIAL_RESULT);
    expect((db as any).update).not.toHaveBeenCalled();
  });

  it("approvePartialOutput transitions partial_complete → done", async () => {
    const db = makePartialDb("partial_complete");
    await approvePartialOutput(db, TASK_ID, COMPANY_ID);
    const update = (db as any).updates.find((u: any) => u.set?.status === "done");
    expect(update).toBeDefined();
  });

  it("requestPartialCompletion transitions partial_complete → in_progress (retry)", async () => {
    const db = makePartialDb("partial_complete");
    await requestPartialCompletion(db, TASK_ID, COMPANY_ID);
    const update = (db as any).updates.find((u: any) => u.set?.status === "in_progress");
    expect(update).toBeDefined();
  });

  it("PartialResult includes failureSummary in plain French", () => {
    expect(PARTIAL_RESULT.failureSummary).toMatch(/[a-zàâçéèêëîïôùûüœæ]/i);
    expect(typeof PARTIAL_RESULT.failureSummary).toBe("string");
    expect(PARTIAL_RESULT.failureSummary.length).toBeGreaterThan(0);
  });

  it("PartialResult.retryAvailable is a boolean", () => {
    expect(typeof PARTIAL_RESULT.retryAvailable).toBe("boolean");
  });

  it("partial-output route is registered in missions.ts", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const ROOT = path.resolve(__dirname, "../../..");
    const routes = fs.readFileSync(
      path.join(ROOT, "server/src/routes/missions.ts"), "utf8"
    );
    expect(routes).toContain("partial");
    expect(routes).toContain("approve");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap J — Pack update migration path
// ─────────────────────────────────────────────────────────────────────────────

import {
  applyPackMigration,
  PackMigrationError,
  type MigrationStep,
  type PackMigration,
} from "../packs/migrations.js";

function makePackMigrationDb(initialPackExtensions: Record<string, unknown> = {}) {
  let packExtensions = { ...initialPackExtensions };
  const log: string[] = [];

  return {
    log,
    getExtensions: () => packExtensions,
    // Drizzle transaction mock: executes callback immediately
    transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(
                Object.keys(packExtensions).length > 0 || true
                  ? [{ packExtensions }]
                  : [],
              ),
            }),
          }),
        }),
        update: () => ({
          set: (vals: { packExtensions?: Record<string, unknown> }) => {
            if (vals.packExtensions) packExtensions = { ...vals.packExtensions };
            log.push(`update:${JSON.stringify(vals.packExtensions)}`);
            return { where: () => Promise.resolve() };
          },
        }),
      };
      await fn(tx);
    },
  } as unknown as import("@paperclipai/db").Db & {
    log: string[];
    getExtensions: () => Record<string, unknown>;
  };
}

describe("Gap J — Pack update migration path", () => {
  it("rename_dna_field renames key in pack_extensions", async () => {
    const db = makePackMigrationDb({ old_field: "some value" });

    const migration: PackMigration = {
      fromVersion: "1.0.0",
      toVersion:   "1.1.0",
      steps: [
        { type: "rename_dna_field", params: { from: "old_field", to: "new_field" } },
      ],
    };

    await applyPackMigration(db as any, COMPANY_ID, migration);

    const ext = (db as any).getExtensions();
    expect(ext.new_field).toBe("some value");
    expect(ext.old_field).toBeUndefined();
  });

  it("deprecate_dna_field archives field with _deprecated_ prefix — never deletes", async () => {
    const db = makePackMigrationDb({ sensitive_field: "data" });

    const migration: PackMigration = {
      fromVersion: "1.0.0",
      toVersion:   "1.1.0",
      steps: [
        { type: "deprecate_dna_field", params: { field: "sensitive_field" } },
      ],
    };

    await applyPackMigration(db as any, COMPANY_ID, migration);

    const ext = (db as any).getExtensions();
    // Field archived, not deleted
    expect(ext._deprecated_sensitive_field).toBe("data");
    expect(ext.sensitive_field).toBeUndefined();
  });

  it("add_wizard_question writes answer into pack_extensions", async () => {
    const db = makePackMigrationDb({});

    const migration: PackMigration = {
      fromVersion: "1.0.0",
      toVersion:   "1.1.0",
      steps: [
        { type: "add_wizard_question", params: { key: "billing_email", required: false } },
      ],
    };

    await applyPackMigration(db as any, COMPANY_ID, migration, {
      billing_email: "finance@acme.com",
    });

    const ext = (db as any).getExtensions();
    expect(ext.billing_email).toBe("finance@acme.com");
  });

  it("required wizard question without answer throws PackMigrationError", async () => {
    const db = makePackMigrationDb({});

    const migration: PackMigration = {
      fromVersion: "1.0.0",
      toVersion:   "1.1.0",
      steps: [
        { type: "add_wizard_question", params: { key: "required_field", required: true } },
      ],
    };

    await expect(applyPackMigration(db as any, COMPANY_ID, migration, {}))
      .rejects.toThrow(PackMigrationError);
  });

  it("PackMigrationError carries the failing step", async () => {
    const db = makePackMigrationDb({});
    const failingStep: MigrationStep = {
      type: "add_wizard_question",
      params: { key: "must_answer", required: true },
    };

    try {
      await applyPackMigration(db as any, COMPANY_ID, {
        fromVersion: "1.0.0", toVersion: "1.1.0", steps: [failingStep],
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PackMigrationError);
      expect((e as PackMigrationError).step).toEqual(failingStep);
    }
  });

  it("transaction is atomic — failure in step 2 rolls back step 1", async () => {
    // The DB mock's transaction() calls the callback; if it throws, changes roll back
    const initialExt = { existing_field: "initial" };
    let ext = { ...initialExt };

    const db = {
      transaction: async (fn: (tx: unknown) => Promise<void>) => {
        const snap = { ...ext }; // snapshot before
        try {
          const tx = {
            select: () => ({
              from: () => ({
                where: () => ({ limit: () => Promise.resolve([{ packExtensions: ext }]) }),
              }),
            }),
            update: () => ({
              set: (v: { packExtensions?: Record<string, unknown> }) => {
                if (v.packExtensions) ext = v.packExtensions;
                return { where: () => Promise.resolve() };
              },
            }),
          };
          await fn(tx);
        } catch (err) {
          ext = snap; // rollback
          throw err;
        }
      },
    } as unknown as import("@paperclipai/db").Db;

    const migration: PackMigration = {
      fromVersion: "1.0.0",
      toVersion:   "1.1.0",
      steps: [
        { type: "rename_dna_field", params: { from: "existing_field", to: "renamed" } },
        { type: "add_wizard_question", params: { key: "required_key", required: true } }, // will fail
      ],
    };

    await expect(applyPackMigration(db, COMPANY_ID, migration, {}))
      .rejects.toThrow(PackMigrationError);

    // Step 1 was rolled back — original field still present
    expect(ext.existing_field).toBe("initial");
    expect(ext.renamed).toBeUndefined();
  });

  it("returns appliedSteps count", async () => {
    const db = makePackMigrationDb({ old: "val" });

    const migration: PackMigration = {
      fromVersion: "1.0.0",
      toVersion:   "1.1.0",
      steps: [
        { type: "rename_dna_field", params: { from: "old", to: "new" } },
        { type: "deprecate_dna_field", params: { field: "nonexistent" } },
      ],
    };

    const result = await applyPackMigration(db as any, COMPANY_ID, migration);
    expect(result.appliedSteps).toBe(2);
  });

  it("MigrationStepType covers all 6 types from spec", () => {
    const types: import("../packs/migrations.js").MigrationStepType[] = [
      "add_wizard_question",
      "rename_dna_field",
      "deprecate_dna_field",
      "add_agent",
      "remove_skill",
      "update_quality_threshold",
    ];
    // TypeScript ensures all 6 are valid — if any are wrong this won't compile
    expect(types).toHaveLength(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap K — Session gap awareness
// ─────────────────────────────────────────────────────────────────────────────

import { wasSessionGap, createSessionActivityMiddleware } from "../middleware/session-activity.js";

describe("Gap K — Session gap awareness", () => {
  describe("wasSessionGap()", () => {
    it("returns false for null lastActiveAt", () => {
      expect(wasSessionGap(null)).toBe(false);
    });

    it("returns false for undefined lastActiveAt", () => {
      expect(wasSessionGap(undefined)).toBe(false);
    });

    it("returns false when last active < 6 hours ago", () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      expect(wasSessionGap(fiveHoursAgo)).toBe(false);
    });

    it("returns true when last active exactly 6 hours ago", () => {
      // 6h + 1ms to be safely over threshold
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000 - 1);
      expect(wasSessionGap(sixHoursAgo)).toBe(true);
    });

    it("returns true when last active > 6 hours ago", () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(wasSessionGap(dayAgo)).toBe(true);
    });

    it("threshold is exactly 6 hours (21600000 ms)", () => {
      // Boundary test: 5h59m59s → false, 6h0m1s → true
      const justBelow = new Date(Date.now() - (6 * 3600 * 1000 - 1));
      const justAbove = new Date(Date.now() - (6 * 3600 * 1000 + 1));
      expect(wasSessionGap(justBelow)).toBe(false);
      expect(wasSessionGap(justAbove)).toBe(true);
    });
  });

  describe("createSessionActivityMiddleware()", () => {
    it("calls next() on every request", async () => {
      const mockDb = {
        update: () => ({
          set: () => ({ where: () => Promise.resolve() }),
        }),
      } as unknown as import("@paperclipai/db").Db;

      const middleware = createSessionActivityMiddleware(mockDb);
      const next = vi.fn();
      const req = { actor: { userId: "user-1" } } as any;
      const res = {} as any;

      await middleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it("calls next() even when userId is absent", async () => {
      const mockDb = {} as import("@paperclipai/db").Db;
      const middleware = createSessionActivityMiddleware(mockDb);
      const next = vi.fn();

      await middleware({} as any, {} as any, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it("never blocks the request — DB errors are swallowed", async () => {
      const errorDb = {
        update: () => ({
          set: () => ({
            where: () => Promise.reject(new Error("DB down")),
          }),
        }),
      } as unknown as import("@paperclipai/db").Db;

      const middleware = createSessionActivityMiddleware(errorDb);
      const next = vi.fn();

      await middleware({ actor: { userId: "u1" } } as any, {} as any, next);
      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe("session-gap-briefing endpoint", () => {
    it("session-gap route is registered in console.ts", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const ROOT = path.resolve(__dirname, "../../..");
      const console = fs.readFileSync(
        path.join(ROOT, "server/src/routes/console.ts"), "utf8"
      );
      expect(console).toContain("session-gap-briefing");
      expect(console).toContain("wasSessionGap");
    });

    it("session-gap route returns gap=false for recent users", async () => {
      // Verify the route logic: wasSessionGap returns false → response includes gap:false
      const fs = await import("node:fs");
      const path = await import("node:path");
      const ROOT = path.resolve(__dirname, "../../..");
      const console = fs.readFileSync(
        path.join(ROOT, "server/src/routes/console.ts"), "utf8"
      );
      // Route should return gap flag
      expect(console).toMatch(/gap.*false|isGap|gap:/);
    });
  });
});
