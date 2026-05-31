/**
 * server/src/integrations/federated-query.ts
 *
 * AG-12 — Federated live data queries.
 *
 * Agents query live integration state using pre-defined query templates declared
 * in each connector's manifest. Queries are NOT arbitrary API calls — they are
 * named templates with typed parameters (security boundary maintained).
 *
 * GDPR invariant: if gdpr_required = true, the query result is only used in
 * T1_FR (Mistral EU) context — never passed to non-EU models.
 *
 * Cache: if cache_result = true, the result is written to org_memory for reuse.
 * Results are always scoped to the current task context only.
 */

import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { integrationQueryLog, memoryEntries } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "federated-query" });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QueryIntegrationAction {
  type:             "query_integration";
  integrationSlug:  string;
  queryTemplate:    string;       // pre-defined query name from connector manifest
  params:           Record<string, string>;
  gdprRequired:     boolean;
  cacheResult:      boolean;
}

export interface QueryResult {
  integrationSlug: string;
  queryTemplate:   string;
  data:            unknown;
  tokens:          number;
  cached:          boolean;
  gdprRequired:    boolean;
}

// ── Query template registry ───────────────────────────────────────────────────

/**
 * Pre-defined query templates per integration.
 * Connectors register their available templates here.
 * This is the security boundary — agents cannot execute arbitrary queries.
 */
const QUERY_TEMPLATES: Record<string, Record<string, QueryTemplateHandler>> = {
  gmail: {
    get_thread:       gmailGetThread,
    list_recent:      gmailListRecent,
    search_by_sender: gmailSearchBySender,
  },
  hubspot: {
    get_contact:        hubspotGetContact,
    list_recent_deals:  hubspotListRecentDeals,
    get_company_health: hubspotGetCompanyHealth,
  },
  boondmanager: {
    get_candidate:    boondGetCandidate,
    list_openings:    boondListOpenings,
  },
};

type QueryTemplateHandler = (
  params: Record<string, string>,
  credential: string,
) => Promise<{ data: unknown; tokens: number }>;

// ── executeQuery ──────────────────────────────────────────────────────────────

/**
 * Execute a pre-defined integration query.
 *
 * Security: only templates declared in QUERY_TEMPLATES are allowed.
 * Unknown template → throws FederatedQueryError (never silently proceeds).
 */
export async function executeQuery(opts: {
  db:          Db;
  companyId:   string;
  taskId?:     string;
  agentId?:    string;
  action:      QueryIntegrationAction;
  credential:  string;    // decrypted by vault server-side before call
}): Promise<QueryResult> {
  const { db, companyId, taskId, agentId, action, credential } = opts;
  const { integrationSlug, queryTemplate, params, gdprRequired, cacheResult } = action;

  // Validate template exists
  const templateFn = QUERY_TEMPLATES[integrationSlug]?.[queryTemplate];
  if (!templateFn) {
    throw new FederatedQueryError(
      `Unknown query template: ${integrationSlug}.${queryTemplate}`,
    );
  }

  logger.info(
    { companyId, taskId, integrationSlug, queryTemplate, gdprRequired },
    "federated-query: executing",
  );

  // Execute query
  const { data, tokens } = await templateFn(params, credential);

  // Audit log
  await (db as any).insert(integrationQueryLog).values({
    companyId,
    taskId:          taskId ?? null,
    agentId:         agentId ?? null,
    integrationSlug,
    queryTemplate,
    gdprRequired,
    cached:          false,
    resultTokens:    tokens,
  });

  // Optionally cache to org_memory
  if (cacheResult && !gdprRequired) {
    await cacheToOrgMemory(db, companyId, integrationSlug, queryTemplate, params, data);
  }

  return { integrationSlug, queryTemplate, data, tokens, cached: false, gdprRequired };
}

// ── cacheToOrgMemory ──────────────────────────────────────────────────────────

async function cacheToOrgMemory(
  db:              Db,
  companyId:       string,
  integrationSlug: string,
  queryTemplate:   string,
  params:          Record<string, string>,
  data:            unknown,
): Promise<void> {
  const key     = `${integrationSlug}:${queryTemplate}:${JSON.stringify(params)}`;
  const content = JSON.stringify(data);

  await (db as any).insert(memoryEntries).values({
    companyId,
    key,
    content,
    source:    "integration_query",
    expiresAt: new Date(Date.now() + 4 * 3600_000), // 4h TTL for live data
  }).onConflictDoUpdate({
    target: [(memoryEntries as any).companyId, (memoryEntries as any).key],
    set:    { content, updatedAt: new Date() },
  });
}

// ── Template implementations (stubs — real implementations live in connectors) ──

async function gmailGetThread(params: Record<string, string>, _cred: string) {
  // Stub: real implementation in packages/connectors/gmail
  return { data: { threadId: params.thread_id, messages: [] }, tokens: 50 };
}

async function gmailListRecent(params: Record<string, string>, _cred: string) {
  return { data: { messages: [], count: 0 }, tokens: 30 };
}

async function gmailSearchBySender(params: Record<string, string>, _cred: string) {
  return { data: { messages: [], sender: params.sender }, tokens: 40 };
}

async function hubspotGetContact(params: Record<string, string>, _cred: string) {
  return { data: { contactId: params.contact_id, properties: {} }, tokens: 60 };
}

async function hubspotListRecentDeals(params: Record<string, string>, _cred: string) {
  return { data: { deals: [], count: 0 }, tokens: 80 };
}

async function hubspotGetCompanyHealth(params: Record<string, string>, _cred: string) {
  return { data: { companyId: params.company_id, score: null }, tokens: 70 };
}

async function boondGetCandidate(params: Record<string, string>, _cred: string) {
  return { data: { candidateId: params.candidate_id }, tokens: 45 };
}

async function boondListOpenings(params: Record<string, string>, _cred: string) {
  return { data: { openings: [] }, tokens: 35 };
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class FederatedQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FederatedQueryError";
  }
}

// ── getAvailableTemplates ─────────────────────────────────────────────────────

/** List available query templates for a given integration slug. */
export function getAvailableTemplates(integrationSlug: string): string[] {
  return Object.keys(QUERY_TEMPLATES[integrationSlug] ?? {});
}
