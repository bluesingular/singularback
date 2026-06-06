/**
 * server/src/extensions/builtin-actions.ts
 *
 * A4 — Action type registry (open for extension).
 *
 * Replaces hardcoded action type switch/enum with a Map-based registry.
 * Built-in action types are registered here at startup. Integration connectors
 * register additional types when they connect (e.g. send_whatsapp, create_hubspot_deal).
 *
 * Unknown action type at task creation → throws ActionTypeUnknownError (never at runtime).
 *
 * Action handlers are invoked during task execution via the worker pipeline.
 * Each handler receives the action payload and returns a result string (the agent sees).
 */

import pino from "pino";
import { registerWhatsAppActionType } from "../integrations/whatsapp.js";
import { executeQuery } from "../integrations/federated-query.js";
import type { Db } from "@paperclipai/db";
import { checkContactCollision, recordExternalCommunication } from "../safety/collision.js";
import { getTimingRecommendation } from "../contacts/timing.js";
import { checkZeroTolerance, type ZeroToleranceRule } from "../safety/zero-tolerance.js";
import { runGates } from "../gates/engine.js";

const logger = pino({ name: "builtin-actions" });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionContext {
  companyId:  string;
  agentId:    string;
  taskId:     string;
  traceId:    string;
  /** AG-12: database handle for actions that need live data (federated queries). */
  db?:        Db;
  /**
   * Gap E — zero-tolerance rules from the skill frontmatter.
   * Checked before trust calibration; no bypass path exists.
   * Pass `[]` or omit when no rules are declared.
   */
  zeroToleranceRules?: ZeroToleranceRule[];
  /**
   * Company-level context values for zero-tolerance condition evaluation
   * (e.g. { zero_tolerance_financial_threshold: 1000 }).
   */
  companyContext?: Record<string, unknown>;
}

export type ActionHandler = (
  payload: Record<string, unknown>,
  ctx:     ActionContext,
) => Promise<string>;

export interface ActionTypeDefinition {
  slug:        string;
  name:        string;
  description: string;
  /** Whether this action always requires human approval regardless of trust level */
  alwaysRequiresApproval: boolean;
  /** Whether this action can send communications to external parties */
  isExternalCommunication: boolean;
  /**
   * RULE 3 — maps this action to one of the 4 quality gate categories.
   * Defaults to "api_call" when not specified.
   */
  gateActionType?: "send_email" | "publish_content" | "contact_external" | "api_call";
  handler:     ActionHandler;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const registry = new Map<string, ActionTypeDefinition>();

export function registerActionType(def: ActionTypeDefinition): void {
  if (registry.has(def.slug)) {
    logger.warn({ slug: def.slug }, "builtin-actions: overwriting existing registration");
  }
  registry.set(def.slug, def);
  logger.debug({ slug: def.slug }, "builtin-actions: registered");
}

export function getActionType(slug: string): ActionTypeDefinition | undefined {
  return registry.get(slug);
}

export function listActionTypes(): ActionTypeDefinition[] {
  return Array.from(registry.values());
}

export function isKnownActionType(slug: string): boolean {
  return registry.has(slug);
}

export class ActionTypeUnknownError extends Error {
  constructor(slug: string) {
    super(`Unknown action type: "${slug}". Register it before task creation.`);
    this.name = "ActionTypeUnknownError";
  }
}

// ── Built-in action type registrations ───────────────────────────────────────

registerActionType({
  slug:                   "send_email",
  name:                   "Envoyer un email",
  description:            "Envoie un email via l'intégration connectée (Gmail, SMTP)",
  alwaysRequiresApproval: false,  // trust level governs — not hardcoded
  isExternalCommunication: true,
  gateActionType:          "send_email",
  handler: async (payload, ctx) => {
    logger.info({ ...ctx, to: payload.to }, "send_email: dispatched");
    return `Email envoyé à ${payload.to}`;
  },
});

registerActionType({
  slug:                   "create_document",
  name:                   "Créer un document",
  description:            "Génère un document structuré (PDF, DOCX, Notion)",
  alwaysRequiresApproval: false,
  isExternalCommunication: false,
  gateActionType:          "publish_content",
  handler: async (payload, ctx) => {
    logger.info({ ...ctx, title: payload.title }, "create_document: dispatched");
    return `Document créé : ${payload.title}`;
  },
});

registerActionType({
  slug:                   "web_search",
  name:                   "Recherche web",
  description:            "Recherche d'informations sur internet via Firecrawl",
  alwaysRequiresApproval: false,
  isExternalCommunication: false,
  handler: async (payload, ctx) => {
    logger.info({ ...ctx, query: payload.query }, "web_search: dispatched");
    return `Résultats pour : ${payload.query}`;
  },
});

registerActionType({
  slug:                   "handoff_to",
  name:                   "Déléguer à un agent",
  description:            "Transfère une tâche à un autre agent spécialisé",
  alwaysRequiresApproval: false,
  isExternalCommunication: false,
  handler: async (payload, ctx) => {
    logger.info({ ...ctx, targetAgent: payload.agentId }, "handoff_to: dispatched");
    return `Délégué à l'agent ${payload.agentId}`;
  },
});

registerActionType({
  slug:                   "clarify",
  name:                   "Demander une précision",
  description:            "Met la tâche en pause pour demander une clarification à l'opérateur",
  alwaysRequiresApproval: true,   // always surfaces to operator
  isExternalCommunication: false,
  handler: async (payload, ctx) => {
    logger.info({ ...ctx, question: payload.question }, "clarify: dispatched");
    return `Clarification demandée : ${payload.question}`;
  },
});

registerActionType({
  slug:                   "batch",
  name:                   "Traitement par lot",
  description:            "Lance un traitement en lot sur plusieurs éléments",
  alwaysRequiresApproval: false,
  isExternalCommunication: false,
  handler: async (payload, ctx) => {
    const items = Array.isArray(payload.items) ? payload.items.length : 0;
    logger.info({ ...ctx, itemCount: items }, "batch: dispatched");
    return `Lot de ${items} éléments lancé`;
  },
});

registerActionType({
  slug:                   "query_integration",
  name:                   "Interroger une intégration",
  description:            "Requête live sur une intégration connectée (AG-12)",
  alwaysRequiresApproval: false,
  isExternalCommunication: false,
  handler: async (payload, ctx) => {
    const { integrationSlug, queryTemplate, params, gdprRequired, cacheResult } = payload as {
      integrationSlug: string;
      queryTemplate:   string;
      params:          Record<string, string>;
      gdprRequired:    boolean;
      cacheResult:     boolean;
    };
    logger.info({ ...ctx, integration: integrationSlug, queryTemplate }, "query_integration: executing");

    // Credential must be decrypted server-side — never passes to LLM context (RULE 2)
    // For now: credential fetched from company_secrets by integration slug
    // TODO: integrate with Vault service when available
    const credential = ""; // placeholder — vault integration at §36

    if (!ctx.db) {
      logger.warn({ ...ctx }, "query_integration: no db in context — skipping live query");
      return `Requête ${queryTemplate} sur ${integrationSlug} ignorée (contexte limité)`;
    }

    const result = await executeQuery({
      db: ctx.db,
      companyId: ctx.companyId,
      taskId: ctx.taskId,
      agentId: ctx.agentId,
      action: { type: "query_integration", integrationSlug, queryTemplate, params: params ?? {}, gdprRequired: gdprRequired ?? false, cacheResult: cacheResult ?? false },
      credential,
    });

    return typeof result.data === "string"
      ? result.data
      : JSON.stringify(result.data).slice(0, 2000);
  },
});

// Gap G: WhatsApp Business API connector
// Registered at startup; credentials resolved lazily from Vault at call time.
registerWhatsAppActionType();

// ── C2: Collision-aware action executor ───────────────────────────────────────

export class ContactCollisionError extends Error {
  constructor(
    public readonly contactId:   string,
    public readonly lastContact: Date,
    public readonly priorTaskId: string | undefined,
  ) {
    super(`Contact ${contactId} was already reached within the cooldown window`);
    this.name = "ContactCollisionError";
  }
}

/**
 * Execute a registered action type with full safety checks:
 *   Gap E  — zero-tolerance check (no bypass, runs before all else)
 *   RULE 3 — quality gates via runGates()
 *   C2     — collision detection for external comms
 *
 * contactId is required when the action targets a specific contact.
 * Pass undefined for broadcast / non-contact actions.
 */
export async function executeAction(
  db:         Db,
  slug:       string,
  payload:    Record<string, unknown>,
  ctx:        ActionContext,
  contactId?: string,
): Promise<string> {
  const def = registry.get(slug);
  if (!def) throw new ActionTypeUnknownError(slug);

  // Gap E: zero-tolerance check — MUST run before trust calibration / quality gates.
  // Throws ZeroToleranceViolation → caller must force pending_approval.
  if (ctx.zeroToleranceRules && ctx.zeroToleranceRules.length > 0) {
    checkZeroTolerance(
      ctx.zeroToleranceRules,
      { type: slug, params: payload },
      ctx.companyContext ?? {},
    );
  }

  // RULE 3: quality gates — mandatory for every external action, no bypass.
  const gateActionType = def.gateActionType ?? "api_call";
  const gateResult = await runGates(db, {
    companyId:  ctx.companyId,
    agentId:    ctx.agentId,
    taskId:     ctx.taskId,
    actionType: gateActionType,
    actionData: payload,
  });
  if (!gateResult.passed) {
    throw new Error(`Quality gate blocked action "${slug}": ${gateResult.reason}`);
  }

  // C2: collision detection for any external communication action
  if (def.isExternalCommunication && contactId) {
    const collision = await checkContactCollision(db, ctx.companyId, contactId);
    if (collision.collision) {
      throw new ContactCollisionError(contactId, collision.lastContact!, collision.taskId);
    }

    // Gap M: contact timing optimisation — log recommendation (non-blocking)
    // Scheduling delay is applied upstream by the worker if delayMs > 0.
    const timing = await getTimingRecommendation(db, contactId, ctx.companyId).catch(() => null);
    if (timing && timing.delayMs > 0) {
      logger.info(
        { contactId, companyId: ctx.companyId, taskId: ctx.taskId, delayMs: timing.delayMs, reason: timing.reason },
        "gap-m: contact timing recommendation — optimal window in future",
      );
      // Delay is surfaced to the approval card via task metadata (not blocking here)
    }
  }

  const result = await def.handler(payload, ctx);

  // Record the communication so future actions see the cooldown
  if (def.isExternalCommunication && contactId) {
    await recordExternalCommunication(
      db,
      ctx.companyId,
      contactId,
      ctx.agentId,
      ctx.taskId,
      result,
    );
  }

  return result;
}
