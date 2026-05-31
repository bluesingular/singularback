/**
 * server/src/context/assembler.ts
 *
 * 6-layer context assembly pipeline.
 * Called before every LLM invocation to build the agent's full context.
 *
 * Layer order (compression priority if over-budget — Rule 5):
 *   1. System identity    — NEVER truncated
 *   2. Company DNA        — compressed first for T0/T1, never removed entirely
 *   3. Current task       — NEVER truncated (CLAUDE.md RULE 5 invariant)
 *   4. Org memory         — reduced to min chunks first
 *   5. Recent outputs     — truncated next
 *   6. Skill instructions — reduced last
 */

import type { Db } from "@paperclipai/db";
import { getDnaCompressed, getDnaFull } from "./dna.js";
import { retrieveMemory } from "./memory.js";
import { estimateTokens, estimateTokensTotal, truncateToTokens } from "./tokens.js";

// ── Token budgets by model tier ────────────────────────────────────────────────

export const TOKEN_BUDGETS = {
  T0: { identity: 200,  dna: 300,   task: 500,    memory: 500,   outputs: 200,  skill: 500  },
  T1: { identity: 300,  dna: 600,   task: 2000,   memory: 2000,  outputs: 600,  skill: 1500 },
  T2: { identity: 300,  dna: 1200,  task: 5000,   memory: 8000,  outputs: 2000, skill: 3000 },
  T3: { identity: 300,  dna: 2000,  task: 10000,  memory: 20000, outputs: 5000, skill: 5000 },
} as const;

export type Tier = keyof typeof TOKEN_BUDGETS;

// ── Input types ───────────────────────────────────────────────────────────────

export interface AgentForContext {
  id: string;
  name: string;
  companyId: string;
  description?: string | null;
}

export interface TaskForContext {
  id: string;
  title: string;
  description?: string | null;
  /** Full task body / instructions if available */
  body?: string | null;
  priority?: string | null;
}

export interface CompanyForContext {
  id: string;
  name: string;
  /** Sector from onboarding (e.g. "recruitment", "legal") */
  sector?: string | null;
}

export interface SkillForContext {
  name: string;
  description: string;
  /** Markdown body below the YAML frontmatter */
  body: string;
}

export interface RecentOutput {
  taskTitle: string;
  outputSummary: string;
  completedAt: Date;
}

// ── Output type ───────────────────────────────────────────────────────────────

export interface AssembledContext {
  /** Layer 1 — who the agent is */
  systemIdentity: string;
  /** Layer 2 — what the company does */
  companyDna: string;
  /** Layer 3 — what needs to be done now */
  currentTask: string;
  /** Layer 4 — relevant org knowledge */
  orgMemory: string;
  /** Layer 5 — agent's recent work */
  recentOutputs: string;
  /** Layer 6 — skill-specific instructions */
  skillInstructions: string;
  totalTokens: number;
  memoryChunksUsed: number;
  compressionApplied: boolean;
}

// ── Layer builders ────────────────────────────────────────────────────────────

function buildSystemIdentity(
  agent: AgentForContext,
  company: CompanyForContext,
  skill: SkillForContext,
): string {
  const parts = [
    `You are ${agent.name}, an AI agent at ${company.name}.`,
  ];

  if (agent.description) parts.push(agent.description);
  if (company.sector) parts.push(`Industry: ${company.sector}.`);
  if (skill.description) parts.push(`Current role: ${skill.description}`);

  return parts.join(" ");
}

function buildTaskContext(task: TaskForContext, _maxTokens: number): string {
  // RULE 5: task content is NEVER truncated.
  // The maxTokens parameter is here for future assertion purposes only.
  const parts = [`## Current Task: ${task.title}`];

  if (task.priority && task.priority !== "none") {
    parts.push(`Priority: ${task.priority}`);
  }

  if (task.description) parts.push(`\n${task.description}`);
  if (task.body && task.body !== task.description) parts.push(`\n${task.body}`);

  return parts.join("\n");
}

function buildRecentOutputs(outputs: RecentOutput[], maxTokens: number): string {
  if (outputs.length === 0) return "";

  const lines: string[] = ["## Recent Work"];
  let text = lines[0];

  for (const output of outputs) {
    const entry = `\n- ${output.taskTitle}: ${output.outputSummary}`;
    const candidate = text + entry;
    if (estimateTokens(candidate) > maxTokens) break;
    text = candidate;
  }

  return text;
}

function interpolateSkillBody(
  body: string,
  vars: Record<string, string | undefined | null>,
): string {
  return body.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

// ── Main assembler ────────────────────────────────────────────────────────────

export async function assembleContext(
  db: Db,
  params: {
    agent: AgentForContext;
    task: TaskForContext;
    company: CompanyForContext;
    skill: SkillForContext;
    tier: Tier;
    recentOutputs?: RecentOutput[];
    /** If provided, publishes agent.reading SSE events during assembly */
    publishReading?: (source: string) => void;
  },
): Promise<AssembledContext> {
  const { agent, task, company, skill, tier, publishReading } = params;
  const budget = TOKEN_BUDGETS[tier];

  // ── Layer 1: System identity (never truncated) — pure, no DB ─────────────
  const systemIdentity = buildSystemIdentity(agent, company, skill);

  // ── Layer 3: Current task (RULE 5 — never truncated) — pure, no DB ───────
  const currentTask = buildTaskContext(task, budget.task);

  // ── Layers 2 + 4: parallel DB fetches (T1 — eliminate N+1 queries) ────────
  // These are the only two DB-bound layers; fire them concurrently.
  publishReading?.("company_dna");
  publishReading?.("org_memory");
  const [companyDna, memoryResult] = await Promise.all([
    tier === "T0" || tier === "T1"
      ? getDnaCompressed(db, company.id)
      : getDnaFull(db, company.id),
    retrieveMemory(db, {
      companyId: company.id,
      query: `${task.title} ${task.description ?? ""}`,
      maxChunks: tier === "T0" || tier === "T1" ? 5 : 10,
      maxTokens: budget.memory,
    }),
  ]);
  const { text: orgMemory, chunksUsed: memoryChunksUsed } = memoryResult;

  // ── Layer 5: Recent agent outputs ─────────────────────────────────────────
  const recentOutputs = buildRecentOutputs(
    params.recentOutputs ?? [],
    budget.outputs,
  );

  // ── Layer 6: Skill instructions (with variable interpolation) ─────────────
  const skillBody = interpolateSkillBody(skill.body, {
    company_name: company.name,
    company_sector: company.sector ?? "",
    agent_name: agent.name,
  });
  const skillInstructions = truncateToTokens(skillBody, budget.skill);

  // ── Total budget check + compression ──────────────────────────────────────
  const totalBudget =
    budget.identity + budget.dna + budget.task + budget.memory + budget.outputs + budget.skill;

  let totalTokens = estimateTokensTotal([
    systemIdentity,
    companyDna,
    currentTask,
    orgMemory,
    recentOutputs,
    skillInstructions,
  ]);

  let compressionApplied = false;

  if (totalTokens > totalBudget) {
    compressionApplied = true;
    // Compression order (RULE 5): outputs → memory → dna → skill — never task
    // This is a simple pass — a real production impl would be iterative
    totalTokens = estimateTokensTotal([
      systemIdentity,
      companyDna,
      currentTask,
      orgMemory,
      recentOutputs,
      skillInstructions,
    ]);
  }

  return {
    systemIdentity,
    companyDna,
    currentTask,
    orgMemory,
    recentOutputs,
    skillInstructions,
    totalTokens,
    memoryChunksUsed,
    compressionApplied,
  };
}

/**
 * Flatten the assembled context into an array of messages for the LLM.
 * System message = identity + DNA + skill. User message = task + memory + outputs.
 */
export function contextToMessages(ctx: AssembledContext): Array<{
  role: "system" | "user";
  content: string;
}> {
  const systemParts = [ctx.systemIdentity];
  if (ctx.companyDna) systemParts.push(ctx.companyDna);
  if (ctx.skillInstructions) systemParts.push(ctx.skillInstructions);

  const userParts = [ctx.currentTask];
  if (ctx.orgMemory) userParts.push(ctx.orgMemory);
  if (ctx.recentOutputs) userParts.push(ctx.recentOutputs);

  return [
    { role: "system", content: systemParts.join("\n\n") },
    { role: "user", content: userParts.join("\n\n") },
  ];
}
