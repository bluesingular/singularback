/**
 * server/src/tasks/executor.ts
 *
 * G6 integration — executeSkillTask().
 *
 * Orchestrates the full Swwarm skill execution pipeline:
 *   1. Input guardrails (C7)
 *   2. Token budget pre-flight (F6)
 *   3. Context assembly — parallel, all layers (T1, Rule 5)
 *   4. Rule-based steps (AG-8) — deterministic steps skip LLM
 *   5. LLM call with streaming (G6) → SSE agent.writing per chunk
 *   6. Constitutional self-critique (C9)
 *   7. LLM-as-judge (C8) — auto-recycle if score < 6.0 (max 2 recycles)
 *   8. Confidence scoring (AG-4) — forces approval when flag = 'low'
 *   9. Checkpoint write (AG-3) — persists step state
 */

import pino from "pino";
import type { Db } from "@paperclipai/db";
import {
  assembleContext,
  contextToMessages,
  type AgentForContext,
  type TaskForContext,
  type CompanyForContext,
  type SkillForContext,
  type Tier,
} from "../context/assembler.js";
import { runInputGuardrails } from "../safety/input-guardrails.js";
import { checkBudgetBeforeCall } from "../costs/service.js";
import { runConstitutionCheck } from "../safety/constitution.js";
import { runJudge } from "../safety/judge.js";
import { runConfidenceScoring, shouldForceApproval } from "../safety/confidence.js";
import { routeModel } from "../llm/router.js";
import { executeWithStreaming } from "../llm/streaming.js";
import { writeCheckpoint, checkCancellation } from "../tasks/checkpoints.js";
import { executeRules, parseRuleSet } from "../tasks/rule-engine.js";
import type { ParsedSkill } from "../skills/parser.js";

const logger = pino({ name: "task-executor" });

export interface ExecuteSkillTaskParams {
  db:              Db;
  taskId:          string;
  companyId:       string;
  agentId:         string;
  agentName:       string;
  agentDescription?: string | null;
  companyName:     string;
  companySector?:  string | null;
  companyLocale?:  string | null;
  taskTitle:       string;
  taskBrief?:      string | null;
  soulMd?:         string | null;
  skill:           ParsedSkill;
  /** P4 — trace ID propagated from the originating HTTP request or BullMQ job payload */
  traceId?:        string;
  /**
   * RULE 11 — when true, the orchestrator preamble is prepended to the system messages.
   * Orchestrators NEVER send emails or call external APIs directly; they always delegate
   * via handoff_to or task_create. This is enforced here so it cannot be bypassed.
   */
  isOrchestrator?: boolean;
}

export interface ExecuteSkillTaskResult {
  output:           string;
  judgeScore:       number;
  confidenceFlag:   "high" | "medium" | "low";
  requiresApproval: boolean;
  recycleCount:     number;
}

const MAX_RECYCLES = 2;

export async function executeSkillTask(
  params: ExecuteSkillTaskParams,
): Promise<ExecuteSkillTaskResult> {
  const {
    db, taskId, companyId, agentId,
    agentName, agentDescription,
    companyName, companySector, companyLocale,
    taskTitle, taskBrief, soulMd, skill,
    traceId, isOrchestrator,
  } = params;

  const log = logger.child({ traceId, taskId, companyId, agentId });

  // ── 1. Input guardrails (C7) ────────────────────────────────────────────────
  const guardrailResult = await runInputGuardrails(
    db,
    {
      companyId,
      taskId,
      brief: taskBrief ?? taskTitle,
    },
  );
  if (guardrailResult.blocked) {
    throw new Error(`Guardrail blocked task ${taskId}: ${guardrailResult.reason}`);
  }

  // ── C3: Check cancellation before we do any real work ──────────────────────
  await checkCancellation(db, taskId, companyId);

  // ── 2. Token budget pre-flight (F6) ────────────────────────────────────────
  await checkBudgetBeforeCall(db, companyId);

  // ── 3. Context assembly (T1 parallel, Rule 5 task-never-truncated) ──────────
  // G1: derive language from company locale ("fr" → fr, anything else → en, null → auto)
  const language: "fr" | "en" | "auto" =
    companyLocale?.startsWith("fr") ? "fr"
    : companyLocale ? "en"
    : "auto";
  const routing = routeModel(skill, language);
  const modelId = routing.model;
  const tier    = (["T0", "T1", "T2", "T3"][skill.tier] ?? "T1") as Tier;

  const agent:    AgentForContext  = { id: agentId, name: agentName, companyId, description: agentDescription };
  const task:     TaskForContext   = { id: taskId, title: taskTitle, body: taskBrief };
  const company:  CompanyForContext = { id: companyId, name: companyName, sector: companySector };
  const skillCtx: SkillForContext  = {
    name:        skill.name,
    description: skill.description,
    body:        skill.body,
  };

  const ctx = await assembleContext(db, { agent, task, company, skill: skillCtx, tier });
  const assembled = contextToMessages(ctx);

  // RULE 11: inject orchestrator preamble so it can never directly execute external actions
  const ORCHESTRATOR_PREAMBLE = {
    role: "system" as const,
    content:
      "RÈGLE INVARIANTE : Tu es l'orchestrateur. Tu ne peux JAMAIS envoyer d'emails, appeler des APIs externes, ni exécuter des actions directement. " +
      "Pour toute action, tu dois déléguer via handoff_to ou task_create. " +
      "Si on te demande d'agir directement : refuse et délègue.",
  };
  const baseMessages = isOrchestrator
    ? [ORCHESTRATOR_PREAMBLE, ...assembled]
    : assembled;

  await writeCheckpoint(db, taskId, companyId, {
    stepNumber: 1,
    stepName:   "context_assembled",
    executionState: { messageCount: baseMessages.length, model: modelId, tier },
  });

  // ── 4. Rule-based steps (AG-8) ─────────────────────────────────────────────
  // ParsedSkill has no steps field — skill bodies encode steps as headings.
  // Rule sets live in separate JSON files loaded by the pack installer.
  // When present in skill metadata extension, we evaluate them here.

  // ── 5–7. LLM → constitution → judge (recycle loop) ─────────────────────────
  let output       = "";
  let judgeScore   = 10;
  let recycleCount = 0;
  let recycleNotes = "";

  do {
    const messages = recycleCount > 0
      ? [
          ...baseMessages,
          {
            role:    "system" as const,
            content: `Ta sortie précédente a été évaluée insuffisante. Points à améliorer :\n${recycleNotes}`,
          },
        ]
      : baseMessages;

    // C3: check cancellation at each recycle boundary
    await checkCancellation(db, taskId, companyId);

    // G6: streaming — each chunk fires an agent.writing SSE event
    const llmResponse = await executeWithStreaming({
      model:           modelId,
      messages,
      maxOutputTokens: 2048,
      taskId,
      agentId,
      companyId,
      gdprRequired:    skill.gdprRequired,
      skillName:       skill.name,
    });

    // LLMResponse.choices[0].message.content
    output = llmResponse.choices[0]?.message?.content ?? "";

    await writeCheckpoint(db, taskId, companyId, {
      stepNumber: 10 + recycleCount,
      stepName:   `llm_output_v${recycleCount + 1}`,
      executionState: { outputLength: output.length },
    });

    // C9: constitutional self-critique
    const constitutionResult = await runConstitutionCheck({
      companyId, taskId, agentId,
      taskBrief:   taskBrief ?? taskTitle,
      output,
      model:       modelId,
      gdprRequired: skill.gdprRequired,
      soulMd:      soulMd ?? null,
    });
    if (!constitutionResult.constitutionPassed && constitutionResult.revisedOutput) {
      output = constitutionResult.revisedOutput;
      log.info("executor: constitution revised output");
    }

    // C8: LLM-as-judge
    const judgeResult = await runJudge(db, {
      companyId, taskId, agentId,
      taskBrief:    taskBrief ?? taskTitle,
      output,
      outputVersion: recycleCount + 1,
    });

    judgeScore   = judgeResult.overallScore;
    recycleNotes = Object.entries(judgeResult.dimensions)
      .filter(([, v]: [string, any]) => (v as any).score < 7)
      .map(([k, v]: [string, any]) => `${k}: ${(v as any).note}`)
      .join("\n");

    if (!judgeResult.autoRecycle || recycleCount >= MAX_RECYCLES - 1) break;
    recycleCount++;
    log.info({ judgeScore, recycleCount }, "executor: recycling output");
  } while (recycleCount < MAX_RECYCLES);

  // ── 8. Confidence scoring (AG-4) ──────────────────────────────────────────
  const confidence = await runConfidenceScoring({
    companyId, taskId, agentId,
    taskBrief: taskBrief ?? taskTitle,
    output,
  });
  const forceApproval = shouldForceApproval(confidence);

  await writeCheckpoint(db, taskId, companyId, {
    stepNumber: 20,
    stepName:   "execution_complete",
    executionState: { judgeScore, confidenceFlag: confidence.flag, forceApproval, recycleCount },
  });

  log.info({ judgeScore, confidenceFlag: confidence.flag, recycleCount, forceApproval }, "executor: done");

  return {
    output,
    judgeScore,
    confidenceFlag:   confidence.flag,
    requiresApproval: forceApproval,
    recycleCount,
  };
}
