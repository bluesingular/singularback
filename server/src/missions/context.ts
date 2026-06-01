/**
 * server/src/missions/context.ts
 *
 * AG-1 — Mission context: shared working memory for parallel agents on the same mission.
 *
 * All agents on a mission can read and write keyed values. Last write wins
 * (enforced by the UNIQUE constraint on mission_id + context_key with ON CONFLICT DO UPDATE).
 *
 * Fan-out: orchestrator creates a parallel group by spawning multiple tasks against
 * the same mission. They share this context store to pass intermediate findings.
 *
 * Fan-in: caller awaits all task IDs in the parallel group, then reads the
 * accumulated context for synthesis.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { missionContext } from "@paperclipai/db";

export interface ParallelGroup {
  groupId:     string;
  taskIds:     string[];
  status:      "running" | "complete" | "partial_failure";
  completedAt: Date | null;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Read a single keyed value from mission shared memory. Returns null if absent. */
export async function getMissionContextValue(
  db: Db,
  missionId: string,
  contextKey: string,
): Promise<unknown | null> {
  const row = await db.query.missionContext.findFirst({
    where: and(
      eq(missionContext.missionId, missionId),
      eq(missionContext.contextKey, contextKey),
    ),
  });
  return row?.value ?? null;
}

/** Read all keyed values for a mission. Returns a plain object. */
export async function getAllMissionContext(
  db: Db,
  missionId: string,
): Promise<Record<string, unknown>> {
  const rows = await db.query.missionContext.findMany({
    where: eq(missionContext.missionId, missionId),
    orderBy: (t, { asc }) => [asc(t.contextKey)],
  });
  return Object.fromEntries(rows.map((r) => [r.contextKey, r.value]));
}

/** Read a specific set of keys in one query. */
export async function getMissionContextKeys(
  db: Db,
  missionId: string,
  keys: string[],
): Promise<Record<string, unknown>> {
  if (keys.length === 0) return {};
  const rows = await db.query.missionContext.findMany({
    where: and(
      eq(missionContext.missionId, missionId),
      inArray(missionContext.contextKey, keys),
    ),
  });
  return Object.fromEntries(rows.map((r) => [r.contextKey, r.value]));
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Write (upsert) a keyed value. Last write wins per the UNIQUE constraint. */
export async function setMissionContextValue(
  db: Db,
  opts: {
    missionId:  string;
    companyId:  string;
    contextKey: string;
    value:      unknown;
    writtenBy:  string;   // agent ID
  },
): Promise<void> {
  await db
    .insert(missionContext)
    .values({
      missionId:  opts.missionId,
      companyId:  opts.companyId,
      contextKey: opts.contextKey,
      value:      opts.value,
      writtenBy:  opts.writtenBy,
    })
    .onConflictDoUpdate({
      target: [missionContext.missionId, missionContext.contextKey],
      set: {
        value:     opts.value,
        writtenBy: opts.writtenBy,
        writtenAt: new Date(),
      },
    });
}

/** Write multiple keys in a single statement. Each key is upserted independently. */
export async function setMissionContextValues(
  db: Db,
  opts: {
    missionId: string;
    companyId: string;
    writtenBy: string;
    entries:   Record<string, unknown>;
  },
): Promise<void> {
  const pairs = Object.entries(opts.entries);
  if (pairs.length === 0) return;

  for (const [contextKey, value] of pairs) {
    await setMissionContextValue(db, {
      missionId:  opts.missionId,
      companyId:  opts.companyId,
      contextKey,
      value,
      writtenBy:  opts.writtenBy,
    });
  }
}

// ── Fan-out helpers ───────────────────────────────────────────────────────────

/**
 * Record that a parallel group has been dispatched.
 * Writes a `_group:{groupId}` meta-key into mission context so the orchestrator
 * can track which task IDs are in flight for this group.
 */
export async function registerParallelGroup(
  db: Db,
  opts: {
    groupId:   string;
    missionId: string;
    companyId: string;
    taskIds:   string[];
    writtenBy: string;
  },
): Promise<void> {
  await setMissionContextValue(db, {
    missionId:  opts.missionId,
    companyId:  opts.companyId,
    contextKey: `_group:${opts.groupId}`,
    value: {
      groupId:     opts.groupId,
      taskIds:     opts.taskIds,
      status:      "running" as const,
      completedAt: null,
    } satisfies ParallelGroup,
    writtenBy: opts.writtenBy,
  });
}

/**
 * Mark a parallel group complete (all tasks resolved).
 * Called by the orchestrator after fan-in.
 */
export async function completeParallelGroup(
  db: Db,
  opts: {
    groupId:      string;
    missionId:    string;
    companyId:    string;
    writtenBy:    string;
    partialFailure?: boolean;
  },
): Promise<void> {
  const current = (await getMissionContextValue(
    db,
    opts.missionId,
    `_group:${opts.groupId}`,
  )) as ParallelGroup | null;

  if (!current) return;

  await setMissionContextValue(db, {
    missionId:  opts.missionId,
    companyId:  opts.companyId,
    contextKey: `_group:${opts.groupId}`,
    value: {
      ...current,
      status:      opts.partialFailure ? "partial_failure" : "complete",
      completedAt: new Date(),
    } satisfies ParallelGroup,
    writtenBy: opts.writtenBy,
  });
}
