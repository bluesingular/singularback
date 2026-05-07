/**
 * server/src/routes/agent-config.ts
 *
 * Gap F — Agent configuration API.
 * G2   — Agent capability declarations.
 *
 * GET  /companies/:companyId/agents/:agentId/capabilities
 *   Returns machine-readable capability declaration for the agent:
 *   all skills with inputs, outputSchema, aiAct, tools, gdpr/web posture.
 *   Includes aggregate flags (requiresGdpr, requiresWebAccess, autonomyTier, aiActRiskLevel).
 *
 * GET  /companies/:companyId/agents/:agentId/config
 *   Returns the aggregated config_params from all skills assigned to the agent,
 *   plus the current values stored in agent.runtimeConfig.
 *
 * PUT  /companies/:companyId/agents/:agentId/config
 *   Validates values against each param's type constraints, then merges into
 *   agent.runtimeConfig. Rejects values that violate min/max or aren't in
 *   the declared options list.
 */

import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import pino from "pino";
import { agents, companySkills } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess, requireRole } from "./authz.js";
import type { ConfigParam } from "../skills/parser.js";

const log = pino({ name: "agent-config-routes" });

// ── Value validation ──────────────────────────────────────────────────────────

function validateParamValue(
  param: ConfigParam,
  value: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (param.type) {
    case "toggle":
      if (typeof value !== "boolean")
        return { ok: false, error: `${param.name}: doit être un booléen` };
      return { ok: true, value };

    case "number": {
      const n = Number(value);
      if (Number.isNaN(n))
        return { ok: false, error: `${param.name}: doit être un nombre` };
      if (param.min !== undefined && n < param.min)
        return { ok: false, error: `${param.name}: minimum ${param.min}` };
      if (param.max !== undefined && n > param.max)
        return { ok: false, error: `${param.name}: maximum ${param.max}` };
      return { ok: true, value: n };
    }

    case "select":
      if (!param.options?.includes(String(value)))
        return {
          ok: false,
          error: `${param.name}: valeur invalide — options: ${param.options?.join(", ")}`,
        };
      return { ok: true, value: String(value) };

    case "text":
      return { ok: true, value: String(value ?? "") };

    case "text_list":
      if (!Array.isArray(value))
        return { ok: false, error: `${param.name}: doit être une liste` };
      return { ok: true, value: (value as unknown[]).map(String) };

    default:
      return { ok: true, value };
  }
}

// ── Route builder ─────────────────────────────────────────────────────────────

// AI Act risk level ordering for aggregate computation
const RISK_ORDER = { none: 0, low: 1, limited: 2, high: 3 } as const;
type RiskLevel = keyof typeof RISK_ORDER;

export function agentConfigRoutes(db: Db) {
  const router = Router();

  // GET /companies/:companyId/agents/:agentId/capabilities
  router.get("/companies/:companyId/agents/:agentId/capabilities", async (req, res) => {
    const { companyId, agentId } = req.params as { companyId: string; agentId: string };
    assertCompanyAccess(req, companyId);

    const [agent] = await (db as any)
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));

    if (!agent) {
      res.status(404).json({ error: "Agent introuvable" });
      return;
    }

    const skillSlugs: string[] = (agent.metadata as any)?.skillsAssigned ?? [];

    let skillRows: any[] = [];
    if (skillSlugs.length > 0) {
      skillRows = await (db as any)
        .select()
        .from(companySkills)
        .where(
          and(
            eq(companySkills.companyId, companyId),
            inArray(companySkills.slug, skillSlugs),
          ),
        );
    }

    // Build per-skill capability objects from stored metadata
    const skills = skillRows.map((row: any) => {
      const m = (row.metadata as Record<string, unknown>) ?? {};
      return {
        slug:           row.slug,
        name:           row.name,
        description:    typeof m.description === "string" ? m.description : "",
        purpose:        typeof m.purpose === "string" ? m.purpose : "",
        gdprRequired:   Boolean(m.gdprRequired ?? false),
        webAccess:      Boolean(m.webAccess ?? false),
        webScope:       m.webScope ?? "open",
        autonomyTier:   m.autonomyTier ?? "A",
        dataCategories: Array.isArray(m.dataCategories) ? m.dataCategories : [],
        inputs:         Array.isArray(m.inputs) ? m.inputs : [],
        outputSchema:   m.outputSchema ?? null,
        aiAct:          m.aiAct ?? { riskLevel: "none", automatedDecision: false, profiling: false, article22Applicable: false },
        tools:          Array.isArray(m.tools) ? m.tools : [],
      };
    });

    // Aggregate posture across all skills
    const requiresGdpr       = skills.some((s) => s.gdprRequired);
    const requiresWebAccess  = skills.some((s) => s.webAccess);
    const autonomyTier       = skills.some((s) => s.autonomyTier === "A") ? "A" : "B";
    const aiActRiskLevel: RiskLevel = skills.reduce<RiskLevel>((max, s) => {
      const level = (s.aiAct as any)?.riskLevel as RiskLevel ?? "none";
      return RISK_ORDER[level] > RISK_ORDER[max] ? level : max;
    }, "none");

    res.json({
      agentId: agent.id,
      agentName: agent.name,
      skills,
      requiresGdpr,
      requiresWebAccess,
      autonomyTier,
      aiActRiskLevel,
    });
  });

  // GET /companies/:companyId/agents/:agentId/config
  router.get("/companies/:companyId/agents/:agentId/config", async (req, res) => {
    const { companyId, agentId } = req.params as { companyId: string; agentId: string };
    assertCompanyAccess(req, companyId);

    const [agent] = await (db as any)
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));

    if (!agent) {
      res.status(404).json({ error: "Agent introuvable" });
      return;
    }

    // Gather skills assigned to this agent from metadata
    const skillSlugs: string[] =
      (agent.metadata as any)?.skillsAssigned ?? [];

    // Load skill rows with their config_params
    let configParams: ConfigParam[] = [];
    if (skillSlugs.length > 0) {
      const skillRows = await (db as any)
        .select()
        .from(companySkills)
        .where(
          and(
            eq(companySkills.companyId, companyId),
            inArray(companySkills.slug, skillSlugs),
          ),
        );

      // Aggregate config_params across all skills (deduplicate by name)
      const seen = new Set<string>();
      for (const row of skillRows) {
        const params: ConfigParam[] = (row.metadata as any)?.configParams ?? [];
        for (const p of params) {
          if (!seen.has(p.name)) {
            seen.add(p.name);
            configParams.push(p);
          }
        }
      }
    }

    // Build current values: default → overridden by runtimeConfig
    const runtimeConfig = (agent.runtimeConfig as Record<string, unknown>) ?? {};
    const currentValues: Record<string, unknown> = {};
    for (const p of configParams) {
      currentValues[p.name] = p.name in runtimeConfig ? runtimeConfig[p.name] : p.default;
    }

    res.json({
      agentId: agent.id,
      agentName: agent.name,
      skillSlugs,
      configParams,
      currentValues,
    });
  });

  // PUT /companies/:companyId/agents/:agentId/config
  router.put("/companies/:companyId/agents/:agentId/config", async (req, res) => {
    const { companyId, agentId } = req.params as { companyId: string; agentId: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "operator");

    const patch = z.record(z.unknown()).parse(req.body);

    // Load agent + skill config_params for validation
    const [agent] = await (db as any)
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));

    if (!agent) {
      res.status(404).json({ error: "Agent introuvable" });
      return;
    }

    const skillSlugs: string[] = (agent.metadata as any)?.skillsAssigned ?? [];
    let configParams: ConfigParam[] = [];

    if (skillSlugs.length > 0) {
      const skillRows = await (db as any)
        .select()
        .from(companySkills)
        .where(
          and(
            eq(companySkills.companyId, companyId),
            inArray(companySkills.slug, skillSlugs),
          ),
        );

      const seen = new Set<string>();
      for (const row of skillRows) {
        const params: ConfigParam[] = (row.metadata as any)?.configParams ?? [];
        for (const p of params) {
          if (!seen.has(p.name)) {
            seen.add(p.name);
            configParams.push(p);
          }
        }
      }
    }

    // Validate incoming values against declared config_params
    const paramMap = new Map(configParams.map((p) => [p.name, p]));
    const validated: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const [key, value] of Object.entries(patch)) {
      const param = paramMap.get(key);
      if (!param) {
        errors.push(`${key}: paramètre inconnu pour cet agent`);
        continue;
      }
      const result = validateParamValue(param, value);
      if (!result.ok) {
        errors.push(result.error);
      } else {
        validated[key] = result.value;
      }
    }

    if (errors.length > 0) {
      res.status(422).json({ errors });
      return;
    }

    // Merge into existing runtimeConfig
    const existing = (agent.runtimeConfig as Record<string, unknown>) ?? {};
    const newRuntimeConfig = { ...existing, ...validated };

    await (db as any)
      .update(agents)
      .set({ runtimeConfig: newRuntimeConfig, updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));

    log.info({ agentId, keys: Object.keys(validated) }, "agent config updated");

    res.json({ agentId, runtimeConfig: newRuntimeConfig });
  });

  return router;
}
