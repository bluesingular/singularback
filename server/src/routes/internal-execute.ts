/**
 * server/src/routes/internal-execute.ts
 *
 * Internal agent execution endpoint used by the HTTP adapter.
 *
 * POST /internal/agent/execute
 * Header: Authorization: Bearer {INTERNAL_AUTH_TOKEN}
 * Body:   { agentId, runId, context }
 *
 * The paperclip DB user has BYPASSRLS — no need for withTenantDb here.
 * This is an internal trusted service endpoint.
 */

import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { randomUUID } from "crypto";
import pino from "pino";
import type { Db } from "@paperclipai/db";
import { agents, issues, companies, companySkills } from "@paperclipai/db";
import { executeSkillTask } from "../tasks/executor.js";

const logger = pino({ name: "internal-execute" });

const INTERNAL_TOKEN = process.env.INTERNAL_AUTH_TOKEN ?? "";

export function internalExecuteRoutes(db: Db): Router {
  const router = Router();

  // Auth guard — internal token only
  router.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!INTERNAL_TOKEN || auth !== `Bearer ${INTERNAL_TOKEN}`) {
      res.status(401).json({ ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
      return;
    }
    next();
  });

  /**
   * POST /internal/agent/execute
   * Called by the HTTP adapter when a heartbeat fires.
   */
  router.post("/agent/execute", async (req, res) => {
    // P4: generate traceId at request entry; propagate to all downstream calls
    const traceId = (req.headers["x-trace-id"] as string | undefined) ?? randomUUID();
    const { agentId } = req.body ?? {};

    if (!agentId) {
      res.status(400).json({ ok: false, error: { code: "MISSING_AGENT_ID", message: "agentId required" } });
      return;
    }

    try {
      // 1. Load agent (BYPASSRLS user — no tenant scoping needed)
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);

      if (!agent) {
        res.status(404).json({ ok: false, error: { code: "AGENT_NOT_FOUND", message: "Agent not found" } });
        return;
      }

      const companyId = agent.companyId;

      // 2. Load company
      const [company] = await db
        .select({ id: companies.id, name: companies.name, locale: companies.locale })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (!company) {
        res.status(404).json({ ok: false, error: { code: "COMPANY_NOT_FOUND", message: "Company not found" } });
        return;
      }

      // 3. Find next backlog issue assigned to this agent
      const [issue] = await db
        .select()
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.assigneeAgentId, agentId),
            eq(issues.status, "backlog"),
          ),
        )
        .orderBy(asc(issues.createdAt))
        .limit(1);

      if (!issue) {
        logger.info({ traceId, agentId, companyId }, "internal-execute: no backlog issue — nothing to do");
        res.json({ ok: true, data: { executed: false, reason: "no_backlog_issue" } });
        return;
      }

      // 4. Mark issue as in_progress
      await db
        .update(issues)
        .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(issues.id, issue.id));

      logger.info({ traceId, agentId, issueId: issue.id, title: issue.title }, "internal-execute: executing issue");

      // 5. Find installed skill for this agent
      const agentMeta = (agent.metadata as Record<string, unknown>) ?? {};
      const skillSlugs: string[] = (agentMeta.skillsAssigned as string[]) ?? [];

      let skillContent: string | null = null;
      let skillSlug = "general";
      let skillDbId: string | undefined;

      if (skillSlugs.length > 0) {
        const [installedSkill] = await db
          .select({ id: companySkills.id, slug: companySkills.slug, instructions: companySkills.markdown })
          .from(companySkills)
          .where(
            and(
              eq(companySkills.companyId, companyId),
              eq(companySkills.slug, skillSlugs[0]),
            ),
          )
          .limit(1);

        if (installedSkill) {
          skillContent = installedSkill.instructions;
          skillSlug = installedSkill.slug;
          skillDbId = installedSkill.id;
        }
      }

      // 6. Build ParsedSkill
      // Note: pack installer strips YAML frontmatter before storing in company_skills.markdown.
      // The stored content is body-only — don't call parseSkill() on it (needs full SKILL.md).
      // Instead, build ParsedSkill directly with the skill body as instructions.
      const packDesc = (agentMeta.packDescription as string) ?? null;
      const parsedSkill = {
        name:           skillSlug,
        tier:           1 as const,
        gdprRequired:   true,  // default safe: use Mistral EU
        webAccess:      false,
        webScope:       "restricted" as const,
        autonomyTier:   "A" as const,
        purpose:        packDesc,
        dataCategories: [],
        inputs:         [],
        outputSchema:   null,
        aiAct:          { riskLevel: "limited" as const, automatedDecision: false, profiling: false, article22Applicable: false },
        tools:          [],
        configParams:   [],
        description:    packDesc ?? agent.name,
        // Use installed skill body if available, else fall back to minimal instructions
        body: skillContent
          ? skillContent
          : [
              `# ${agent.name}`,
              packDesc ?? `Vous êtes un assistant IA.`,
              ``,
              `## Tâche`,
              `**${issue.title}**`,
              ``,
              issue.description ?? "",
            ].join("\n"),
      };

      // 7. Execute via Swwarm LLM pipeline
      let result: Awaited<ReturnType<typeof executeSkillTask>>;
      try {
        result = await executeSkillTask({
          db,
          taskId:           issue.id,
          companyId,
          agentId:          agent.id,
          agentName:        agent.name,
          agentDescription: packDesc,
          companyName:      company.name,
          companyLocale:    company.locale ?? null,
          taskTitle:        issue.title,
          taskBrief:        issue.description ?? null,
          soulMd:           agent.soulMd ?? null,
          skill:            parsedSkill,
          skillDbId,
          traceId,
        });
      } catch (execErr) {
        logger.error({ traceId, agentId, issueId: issue.id, execErr }, "internal-execute: LLM execution failed");
        // Mark failed so state machine doesn't block — failed → todo is valid
        await db
          .update(issues)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(issues.id, issue.id), eq(issues.status, "in_progress")));
        throw execErr;
      }

      // 8. Transition issue to done, persisting confidence flag in metadata
      await db
        .update(issues)
        .set({
          status:         "done",
          completedAt:    new Date(),
          updatedAt:      new Date(),
          executionState: { confidenceFlag: result.confidenceFlag, judgeScore: result.judgeScore },
        })
        .where(eq(issues.id, issue.id));

      logger.info(
        { traceId, agentId, issueId: issue.id, title: issue.title, judgeScore: result.judgeScore },
        "internal-execute: issue completed successfully",
      );

      res.json({
        ok: true,
        data: {
          executed:   true,
          issueId:    issue.id,
          issueTitle: issue.title,
          judgeScore: result.judgeScore,
        },
      });
    } catch (err: unknown) {
      const errMsg   = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack?.split("\n").slice(0, 5).join(" | ") : undefined;
      logger.error({ traceId, agentId, errMsg, errStack }, "internal-execute: failed");
      res.status(500).json({ ok: false, error: { code: "EXECUTION_FAILED", message: errMsg, stack: errStack } });
    }
  });

  return router;
}
