/**
 * G15 — Third-party action type registry.
 *
 * Action types are the lightweight alternative to full npm plugins.
 * A third-party developer registers a slug + JSON Schema + webhook URL.
 * When an agent invokes the action type, the platform:
 *   1. Looks up the action type by company_id + slug
 *   2. POSTs the input payload to the webhook URL
 *   3. Signs the payload with HMAC-SHA256 (X-Swwarm-Signature header)
 *   4. Returns the webhook response as the action result
 *
 * Invocation timeout: 30 seconds.
 * Signature header format: "sha256=<hex>"
 */

import { createHmac, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { registeredActionTypes } from "@paperclipai/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegisterActionTypeParams {
  companyId: string;
  slug: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  webhookUrl: string;
  createdByUserId?: string;
}

export interface ActionTypeRecord {
  id: string;
  companyId: string | null;
  slug: string;
  name: string;
  description: string | null;
  inputSchema: unknown;
  outputSchema: unknown;
  webhookUrl: string;
  isActive: boolean;
  createdAt: Date;
}

export interface InvokeResult {
  ok: boolean;
  status: number;
  data: unknown;
}

// ── Signature ─────────────────────────────────────────────────────────────────

export function signPayload(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function registerActionType(
  db: Db,
  params: RegisterActionTypeParams,
): Promise<ActionTypeRecord> {
  const webhookSecret = generateWebhookSecret();

  const [row] = await (db as any)
    .insert(registeredActionTypes)
    .values({
      companyId:       params.companyId,
      slug:            params.slug,
      name:            params.name,
      description:     params.description ?? null,
      inputSchema:     params.inputSchema  ?? {},
      outputSchema:    params.outputSchema ?? {},
      webhookUrl:      params.webhookUrl,
      webhookSecret,
      isActive:        true,
      createdByUserId: params.createdByUserId ?? null,
    })
    .returning({
      id:           registeredActionTypes.id,
      companyId:    registeredActionTypes.companyId,
      slug:         registeredActionTypes.slug,
      name:         registeredActionTypes.name,
      description:  registeredActionTypes.description,
      inputSchema:  registeredActionTypes.inputSchema,
      outputSchema: registeredActionTypes.outputSchema,
      webhookUrl:   registeredActionTypes.webhookUrl,
      isActive:     registeredActionTypes.isActive,
      createdAt:    registeredActionTypes.createdAt,
    });

  return row;
}

export async function listActionTypes(
  db: Db,
  companyId: string,
): Promise<ActionTypeRecord[]> {
  return (db as any)
    .select({
      id:           registeredActionTypes.id,
      companyId:    registeredActionTypes.companyId,
      slug:         registeredActionTypes.slug,
      name:         registeredActionTypes.name,
      description:  registeredActionTypes.description,
      inputSchema:  registeredActionTypes.inputSchema,
      outputSchema: registeredActionTypes.outputSchema,
      webhookUrl:   registeredActionTypes.webhookUrl,
      isActive:     registeredActionTypes.isActive,
      createdAt:    registeredActionTypes.createdAt,
    })
    .from(registeredActionTypes)
    .where(
      and(
        eq(registeredActionTypes.companyId, companyId),
        eq(registeredActionTypes.isActive, true),
      ),
    );
}

export async function getActionType(
  db: Db,
  id: string,
  companyId: string,
): Promise<ActionTypeRecord | null> {
  const [row] = await (db as any)
    .select({
      id:           registeredActionTypes.id,
      companyId:    registeredActionTypes.companyId,
      slug:         registeredActionTypes.slug,
      name:         registeredActionTypes.name,
      description:  registeredActionTypes.description,
      inputSchema:  registeredActionTypes.inputSchema,
      outputSchema: registeredActionTypes.outputSchema,
      webhookUrl:   registeredActionTypes.webhookUrl,
      isActive:     registeredActionTypes.isActive,
      createdAt:    registeredActionTypes.createdAt,
    })
    .from(registeredActionTypes)
    .where(
      and(
        eq(registeredActionTypes.id, companyId === "__any__" ? id : id),
        eq(registeredActionTypes.companyId, companyId),
      ),
    );

  return row ?? null;
}

export async function deactivateActionType(
  db: Db,
  id: string,
  companyId: string,
): Promise<{ id: string } | null> {
  const [row] = await (db as any)
    .update(registeredActionTypes)
    .set({ isActive: false })
    .where(
      and(
        eq(registeredActionTypes.id, id),
        eq(registeredActionTypes.companyId, companyId),
        eq(registeredActionTypes.isActive, true),
      ),
    )
    .returning({ id: registeredActionTypes.id });

  return row ?? null;
}

export async function invokeActionType(
  db: Db,
  id: string,
  companyId: string,
  input: unknown,
): Promise<InvokeResult> {
  // Fetch full record including webhookSecret
  const [row] = await (db as any)
    .select({
      webhookUrl:    registeredActionTypes.webhookUrl,
      webhookSecret: registeredActionTypes.webhookSecret,
      isActive:      registeredActionTypes.isActive,
    })
    .from(registeredActionTypes)
    .where(
      and(
        eq(registeredActionTypes.id, id),
        eq(registeredActionTypes.companyId, companyId),
      ),
    );

  if (!row) throw new Error("Action type not found");
  if (!row.isActive) throw new Error("Action type is not active");

  const body = JSON.stringify({ actionTypeId: id, companyId, input });
  const signature = signPayload(row.webhookSecret, body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(row.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Swwarm-Signature": signature,
        "X-Swwarm-Action-Type-Id": id,
      },
      body,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}
