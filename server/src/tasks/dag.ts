/**
 * G8 — Task DAG service.
 *
 * Manages directed acyclic dependencies between tasks (issues).
 * Uses the existing issue_relations table (type = "blocks"):
 *   issueId BLOCKS relatedIssueId
 *   → Task A must be approved before Task B can start.
 *
 * Status contract:
 *   - When a dependency is added, the downstream task is set to "blocked".
 *   - When the upstream task is approved (taskApprovedWorker), releaseBlockedTasks()
 *     checks every downstream task. If ALL its blockers are resolved, the task
 *     transitions to "todo" and its agent receives an immediate heartbeat.
 *   - "Resolved" = upstream status NOT IN (backlog, todo, blocked)
 *     i.e. the task has reached in_progress, in_review, done, or cancelled.
 */

import { eq, and, inArray, notInArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issueRelations, issues } from "@paperclipai/db";
import { emit } from "../queue/emit.js";
import pino from "pino";

const log = pino({ name: "task-dag" });

// Statuses that mean a blocker is still pending (not yet approved/done)
const PENDING_STATUSES = ["backlog", "todo", "blocked"] as const;

// ── Release ───────────────────────────────────────────────────────────────────

/**
 * Called by taskApprovedWorker after a task is approved.
 *
 * Finds all tasks downstream of `approvedTaskId` and releases any whose
 * remaining blockers are all resolved.
 *
 * @returns IDs of tasks that were released (status set to "todo")
 */
export async function releaseBlockedTasks(
  db: Db,
  approvedTaskId: string,
  companyId: string,
): Promise<string[]> {
  // 1. Find all tasks directly downstream of the approved task
  const downstream = await (db as any)
    .select({ relatedIssueId: issueRelations.relatedIssueId })
    .from(issueRelations)
    .where(
      and(
        eq(issueRelations.issueId, approvedTaskId),
        eq(issueRelations.type, "blocks"),
        eq(issueRelations.companyId, companyId),
      ),
    );

  if (downstream.length === 0) return [];

  const downstreamIds: string[] = downstream.map((r: any) => r.relatedIssueId);
  const released: string[] = [];

  for (const taskId of downstreamIds) {
    // 2. Count remaining unresolved blockers for this downstream task
    //    (blockers other than approvedTaskId that are still pending)
    const remainingBlockers = await (db as any)
      .select({ issueId: issueRelations.issueId })
      .from(issueRelations)
      .where(
        and(
          eq(issueRelations.relatedIssueId, taskId),
          eq(issueRelations.type, "blocks"),
          eq(issueRelations.companyId, companyId),
        ),
      );

    const blockerIds: string[] = remainingBlockers
      .map((r: any) => r.issueId)
      .filter((id: string) => id !== approvedTaskId);

    let hasUnresolvedBlockers = false;
    if (blockerIds.length > 0) {
      const pending = await (db as any)
        .select({ id: issues.id })
        .from(issues)
        .where(
          and(
            inArray(issues.id, blockerIds),
            inArray(issues.status, [...PENDING_STATUSES]),
          ),
        );
      hasUnresolvedBlockers = pending.length > 0;
    }

    if (hasUnresolvedBlockers) continue;

    // 3. All blockers resolved — release this task
    const [updated] = await (db as any)
      .update(issues)
      .set({ status: "todo" })
      .where(
        and(
          eq(issues.id, taskId),
          eq(issues.companyId, companyId),
          eq(issues.status, "blocked"),
        ),
      )
      .returning({ id: issues.id, assigneeAgentId: issues.assigneeAgentId });

    if (!updated) continue;

    released.push(taskId);

    // 4. Trigger immediate heartbeat for the task's agent
    if (updated.assigneeAgentId) {
      await emit.heartbeat(
        { agentId: updated.assigneeAgentId, companyId, triggeredBy: "dag_release" as "manual" },
        0,
      );
    }

    log.info({ taskId, approvedTaskId, companyId }, "dag: downstream task released");
  }

  return released;
}

// ── Dependency management ─────────────────────────────────────────────────────

/**
 * Add a blocking dependency: Task A (blockerId) must be approved before Task B (dependentId).
 * Sets Task B status to "blocked" immediately.
 */
export async function addDependency(
  db: Db,
  blockerId: string,
  dependentId: string,
  companyId: string,
  actorId?: string,
): Promise<void> {
  await (db as any).insert(issueRelations).values({
    companyId,
    issueId:        blockerId,
    relatedIssueId: dependentId,
    type:           "blocks",
    createdByUserId: actorId ?? null,
  });

  // Block the downstream task
  await (db as any)
    .update(issues)
    .set({ status: "blocked" })
    .where(
      and(
        eq(issues.id, dependentId),
        eq(issues.companyId, companyId),
        notInArray(issues.status, ["done", "cancelled"]),
      ),
    );

  log.info({ blockerId, dependentId, companyId }, "dag: dependency added");
}

/**
 * Remove a blocking dependency.
 * If the dependent task has no remaining blockers, releases it to "todo".
 */
export async function removeDependency(
  db: Db,
  blockerId: string,
  dependentId: string,
  companyId: string,
): Promise<void> {
  await (db as any)
    .delete(issueRelations)
    .where(
      and(
        eq(issueRelations.issueId, blockerId),
        eq(issueRelations.relatedIssueId, dependentId),
        eq(issueRelations.type, "blocks"),
        eq(issueRelations.companyId, companyId),
      ),
    );

  // Check if dependent still has other unresolved blockers
  const remaining = await (db as any)
    .select({ issueId: issueRelations.issueId })
    .from(issueRelations)
    .where(
      and(
        eq(issueRelations.relatedIssueId, dependentId),
        eq(issueRelations.type, "blocks"),
        eq(issueRelations.companyId, companyId),
      ),
    );

  if (remaining.length === 0) {
    await (db as any)
      .update(issues)
      .set({ status: "todo" })
      .where(
        and(
          eq(issues.id, dependentId),
          eq(issues.companyId, companyId),
          eq(issues.status, "blocked"),
        ),
      );
    log.info({ dependentId, companyId }, "dag: dependency removed, task auto-released");
  }

  log.info({ blockerId, dependentId, companyId }, "dag: dependency removed");
}

// ── DAG view ──────────────────────────────────────────────────────────────────

export interface DagView {
  upstream:   { id: string; title: string; status: string }[];
  downstream: { id: string; title: string; status: string }[];
}

/**
 * Return the immediate upstream (blocking) and downstream (blocked-by) tasks.
 */
export async function getDagView(
  db: Db,
  taskId: string,
  companyId: string,
): Promise<DagView> {
  const upstreamRels = await (db as any)
    .select({ issueId: issueRelations.issueId })
    .from(issueRelations)
    .where(
      and(
        eq(issueRelations.relatedIssueId, taskId),
        eq(issueRelations.type, "blocks"),
        eq(issueRelations.companyId, companyId),
      ),
    );

  const downstreamRels = await (db as any)
    .select({ relatedIssueId: issueRelations.relatedIssueId })
    .from(issueRelations)
    .where(
      and(
        eq(issueRelations.issueId, taskId),
        eq(issueRelations.type, "blocks"),
        eq(issueRelations.companyId, companyId),
      ),
    );

  const upstreamIds   = upstreamRels.map((r: any) => r.issueId);
  const downstreamIds = downstreamRels.map((r: any) => r.relatedIssueId);

  const [upstreamTasks, downstreamTasks] = await Promise.all([
    upstreamIds.length > 0
      ? (db as any).select({ id: issues.id, title: issues.title, status: issues.status }).from(issues).where(inArray(issues.id, upstreamIds))
      : Promise.resolve([]),
    downstreamIds.length > 0
      ? (db as any).select({ id: issues.id, title: issues.title, status: issues.status }).from(issues).where(inArray(issues.id, downstreamIds))
      : Promise.resolve([]),
  ]);

  return { upstream: upstreamTasks, downstream: downstreamTasks };
}
