/**
 * server/src/gates/engine.ts
 *
 * Quality gate engine — runs all active gates for a given action before
 * the action is executed. Auto-protection gates are always active.
 *
 * RULE 3: Every external action passes runGates(). No bypass path.
 *
 * Gate types:
 *   volume_limit       — max N emails/day per agent (blocks)
 *   recipient_whitelist — only allowed domains (blocks)
 *   budget_limit       — monthly spend limit (escalates for approval)
 *   content_forbidden  — forbidden words/topics in content (escalates)
 *   custom             — always passes (future extensibility)
 *
 * On failure:
 *   block    → violation + audit entry written, action stopped
 *   escalate → violation + audit entry + approval_request created, action stopped
 */

import { eq, and, gte, sql } from "drizzle-orm";
import {
  qualityGates,
  gateViolations,
  auditEntries,
  agents,
} from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { createNotification } from "../notifications/service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GateResult =
  | { passed: true }
  | { passed: false; reason: string; action: "block" | "escalate" };

export interface RunGatesParams {
  companyId:  string;
  agentId:    string;
  taskId:     string;
  actionType: "send_email" | "publish_content" | "contact_external" | "api_call";
  actionData: Record<string, unknown>;
}

type GateRow = typeof qualityGates.$inferSelect;

// ── Gate engine ───────────────────────────────────────────────────────────────

/**
 * Run all active gates for a company+agent action.
 * First failing gate stops evaluation (fail-fast).
 * Always writes an audit entry (success or failure).
 *
 * RULE 3: No bypass. Call this before every external action.
 */
export async function runGates(
  db: Db,
  params: RunGatesParams,
): Promise<GateResult> {
  const gates = await getActiveGates(db, params.companyId, params.agentId);

  for (const gate of gates) {
    const result = await checkGate(db, gate, params.actionData);

    if (!result.passed) {
      const resolution = result.action === "block" ? "blocked" : "escalated";

      // Log violation
      await db.insert(gateViolations).values({
        companyId:  params.companyId,
        gateId:     gate.id,
        agentId:    params.agentId,
        taskId:     params.taskId,
        actionType: params.actionType,
        actionData: params.actionData,
        violation:  result.reason,
        resolution,
      });

      // Immutable audit entry
      await db.insert(auditEntries).values({
        companyId:  params.companyId,
        agentId:    params.agentId,
        taskId:     params.taskId,
        actionType: params.actionType,
        actionData: params.actionData,
        result:     resolution,
      });

      // Escalate: create approval request (M13) and notify via SSE (M15)
      if (result.action === "escalate") {
        await createApprovalRequestStub({ ...params, db });
      }

      return result;
    }
  }

  // All gates passed — write success audit entry
  await db.insert(auditEntries).values({
    companyId:  params.companyId,
    agentId:    params.agentId,
    taskId:     params.taskId,
    actionType: params.actionType,
    actionData: params.actionData,
    result:     "success",
  });

  return { passed: true };
}

// ── Gate checkers ─────────────────────────────────────────────────────────────

async function checkGate(
  db: Db,
  gate: GateRow,
  data: Record<string, unknown>,
): Promise<GateResult> {
  switch (gate.gateType) {
    case "volume_limit": {
      const { maxPerDay } = gate.config as { maxPerDay: number };
      const todayCount = await getAgentActionCount(
        db,
        gate.agentId!,
        "send_email",
      );
      if (todayCount >= maxPerDay) {
        return {
          passed: false,
          reason: `Daily limit of ${maxPerDay} emails reached`,
          action: "block",
        };
      }
      return { passed: true };
    }

    case "budget_limit": {
      const [agent] = await db
        .select({
          spentMonthlyCents:  agents.spentMonthlyCents,
          budgetMonthlyCents: agents.budgetMonthlyCents,
        })
        .from(agents)
        .where(eq(agents.id, gate.agentId!))
        .limit(1);

      if (!agent) return { passed: true }; // agent not found → don't block

      const used  = Number(agent.spentMonthlyCents ?? 0);
      const limit = Number(agent.budgetMonthlyCents ?? 0);
      if (limit > 0 && used >= limit) {
        return {
          passed: false,
          reason: "Monthly budget exhausted",
          action: "escalate",
        };
      }
      return { passed: true };
    }

    case "content_forbidden": {
      const { terms } = gate.config as { terms: string[] };
      const content = String(data.content ?? "");
      const found = terms.find((t) =>
        content.toLowerCase().includes(t.toLowerCase()),
      );
      if (found) {
        return {
          passed: false,
          reason: `Forbidden term detected: "${found}"`,
          action: "escalate",
        };
      }
      return { passed: true };
    }

    case "recipient_whitelist": {
      const { allowedDomains } = gate.config as { allowedDomains: string[] };
      const recipient = String(data.to ?? "");
      const domain = recipient.split("@")[1];
      if (!domain || !allowedDomains.includes(domain)) {
        return {
          passed: false,
          reason: `Recipient domain ${domain ?? "(unknown)"} not whitelisted`,
          action: "block",
        };
      }
      return { passed: true };
    }

    default:
      return { passed: true };
  }
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getActiveGates(
  db: Db,
  companyId: string,
  agentId: string,
): Promise<GateRow[]> {
  // Load gates that apply to this company+agent (agent-specific OR company-wide)
  const rows = await db
    .select()
    .from(qualityGates)
    .where(
      and(
        eq(qualityGates.companyId, companyId),
        eq(qualityGates.enabled, true),
      ),
    );

  // Include global (agentId=null) + agent-specific gates
  return rows.filter(
    (g) => g.agentId === null || g.agentId === agentId,
  );
}

async function getAgentActionCount(
  db: Db,
  agentId: string,
  actionType: string,
): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditEntries)
    .where(
      and(
        eq(auditEntries.agentId, agentId),
        eq(auditEntries.actionType, actionType),
        eq(auditEntries.result, "success"),
        gte(auditEntries.createdAt, todayStart),
      ),
    );

  return row?.count ?? 0;
}

// ── Stubs for future modules ──────────────────────────────────────────────────

/**
 * Stub — full implementation in M13 (CEO Console approval flow).
 * Creates an approval_requests record and notifies operator.
 */
async function createApprovalRequestStub(params: RunGatesParams & { db: Db }): Promise<void> {
  await createNotification(params.db, {
    companyId: params.companyId,
    type:      "approval_pending",
    title:     "Action en attente d'approbation",
    body:      `Un agent attend votre validation avant de continuer (${params.actionType}).`,
    actionUrl: `/taches/${params.taskId}`,
    metadata:  { agentId: params.agentId, taskId: params.taskId, actionType: params.actionType },
  });
}
