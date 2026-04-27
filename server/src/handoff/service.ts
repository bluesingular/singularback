/**
 * server/src/handoff/service.ts
 *
 * Agent-to-agent handoff evaluator.
 *
 * When an operator approves a task with a star rating, this service checks
 * whether the completing agent has any handoff rules whose condition is
 * satisfied, and creates follow-on tasks for the target agents.
 *
 * Currently supported conditions:
 *   cv_score_gte_4  — fires when rating >= 4 (used by qualification-cv → client-email)
 *
 * Handoff rules are stored in agents.metadata.handoffs (set by the pack installer).
 */

import { eq, and } from "drizzle-orm";
import { agents, issues } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "handoff" });

export interface HandoffContext {
  companyId:   string;
  /** ID of the issue that was just approved */
  issueId:     string;
  /** ID of the agent that completed the task */
  agentId:     string;
  /** Star rating submitted by the operator (1–5) */
  rating:      number;
  /** Any variables to interpolate into the task template */
  variables?:  Record<string, string>;
}

export interface HandoffResult {
  triggered:    boolean;
  handoffCount: number;
  issueIds:     string[];
}

// ── Condition evaluators ──────────────────────────────────────────────────────

function evaluateCondition(condition: string, rating: number): boolean {
  if (condition === "cv_score_gte_4") return rating >= 4;
  return false;
}

// ── Main evaluator ────────────────────────────────────────────────────────────

export async function evaluateHandoffs(
  db: Db,
  ctx: HandoffContext,
): Promise<HandoffResult> {
  const { companyId, issueId, agentId, rating, variables = {} } = ctx;

  // Load the completing agent's metadata (includes handoffs from pack installer)
  const [agent] = await db
    .select({ id: agents.id, metadata: agents.metadata })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
    .limit(1);

  if (!agent) {
    logger.warn({ agentId, companyId }, "handoff: agent not found");
    return { triggered: false, handoffCount: 0, issueIds: [] };
  }

  const handoffs = (agent.metadata as any)?.handoffs as Array<{
    condition:    string;
    targetAgent:  string;
    taskTemplate: string;
  }> | undefined;

  if (!handoffs || handoffs.length === 0) {
    return { triggered: false, handoffCount: 0, issueIds: [] };
  }

  // Evaluate each handoff rule
  const triggered: string[] = [];

  for (const rule of handoffs) {
    if (!evaluateCondition(rule.condition, rating)) continue;

    // Find the target agent by name in this company
    const [targetAgent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(
        eq(agents.companyId, companyId),
        eq(agents.name, rule.targetAgent),
      ))
      .limit(1);

    if (!targetAgent) {
      logger.warn(
        { targetAgentName: rule.targetAgent, companyId },
        "handoff: target agent not found",
      );
      continue;
    }

    // Interpolate template variables
    const title = rule.taskTemplate.replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => variables[key] ?? `{${key}}`,
    );

    // Create the follow-on issue
    const [newIssue] = await db
      .insert(issues)
      .values({
        companyId,
        title,
        status:          "backlog",
        priority:        "high",
        assigneeAgentId: targetAgent.id,
        originKind:      "handoff",
        originId:        issueId,
        billingCode:     rule.condition,
      })
      .returning({ id: issues.id });

    if (newIssue) {
      triggered.push(newIssue.id);
      logger.info(
        {
          companyId,
          sourceIssueId:  issueId,
          targetAgentId:  targetAgent.id,
          targetAgentName: rule.targetAgent,
          condition:      rule.condition,
          rating,
          newIssueId:     newIssue.id,
        },
        "handoff: follow-on task created",
      );
    }
  }

  return {
    triggered:    triggered.length > 0,
    handoffCount: triggered.length,
    issueIds:     triggered,
  };
}
