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

const logger = pino({ name: "builtin-actions" });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionContext {
  companyId:  string;
  agentId:    string;
  taskId:     string;
  traceId:    string;
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
    logger.info({ ...ctx, integration: payload.integrationSlug }, "query_integration: dispatched");
    return `Requête ${payload.queryTemplate} sur ${payload.integrationSlug}`;
  },
});
