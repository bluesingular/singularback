/**
 * server/src/context/client-assembly.ts
 *
 * §35.2 Client context isolation — context assembly for delivery partner tasks.
 *
 * ISOLATION INVARIANT: org_memory from Client A NEVER appears in Client B's context.
 * Enforced at the DB query level — not application logic only.
 *
 * When clientContextId is set:
 *   clientMemory  → WHERE client_context_id = $ctxId  (strict: only this client)
 *   firmMemory    → WHERE client_context_id IS NULL    (firm-level only)
 *
 * FORBIDDEN: WHERE client_context_id IS NULL OR client_context_id = $ctxId
 *   (this would leak firm-level memory into client context — forbidden by spec)
 *
 * Called from context assembly when task.clientContextId is set.
 */

import { and, eq, isNull, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { memoryEntries, clientContexts, clientSkillOverlays, companyDna } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "client-assembly" });

export interface ClientAssemblyContext {
  firmDna:         Record<string, unknown> | null;
  clientDna:       Record<string, unknown> | null;
  clientMemory:    MemoryEntry[];
  firmMemory:      MemoryEntry[];
  clientOverlay:   ClientOverlay | null;
}

interface MemoryEntry {
  id:        string;
  content:   string;
  source:    string | null;
  createdAt: Date;
}

interface ClientOverlay {
  additionalSoulInstructions: string | null;
  qualityThresholdAdjustment: number | null;
  preferredToneOverride:      string | null;
  sectorVocabulary:           string[];
}

// ── assembleClientContext ─────────────────────────────────────────────────────

/**
 * Assemble context layers for a client-scoped task.
 *
 * Merge order per §35.6: firmDNA → clientDNA → tenantSkill → clientOverlay
 *
 * ISOLATION INVARIANT enforced:
 *   clientMemory query:  WHERE company_id = ? AND client_context_id = ?
 *   firmMemory query:    WHERE company_id = ? AND client_context_id IS NULL
 *   NEVER: OR client_context_id = ... (no cross-context leak)
 */
export async function assembleClientContext(opts: {
  db:              Db;
  companyId:       string;
  clientContextId: string;
  skillId?:        string;
  memoryLimit?:    number;
}): Promise<ClientAssemblyContext> {
  const { db, companyId, clientContextId, skillId, memoryLimit = 10 } = opts;

  const [
    firmDnaRows,
    clientDnaRows,
    clientMemoryRows,
    firmMemoryRows,
    overlayRows,
  ] = await Promise.all([
    // Firm-level DNA
    (db as any)
      .select()
      .from(companyDna)
      .where(eq(companyDna.companyId, companyId))
      .limit(1),

    // Client DNA from client_contexts.client_dna
    (db as any)
      .select({ clientDna: clientContexts.clientDna })
      .from(clientContexts)
      .where(and(
        eq(clientContexts.id, clientContextId),
        eq(clientContexts.companyId, companyId),
      ))
      .limit(1),

    // Client memory — STRICT isolation: ONLY this client's memory
    // WHERE client_context_id = $clientContextId (never IS NULL OR ...)
    (db as any)
      .select({
        id:        memoryEntries.id,
        content:   memoryEntries.content,
        source:    (memoryEntries as any).source,
        createdAt: memoryEntries.createdAt,
      })
      .from(memoryEntries)
      .where(and(
        eq(memoryEntries.companyId, companyId),
        eq((memoryEntries as any).clientContextId, clientContextId),  // ISOLATION
      ))
      .orderBy(desc(memoryEntries.createdAt))
      .limit(memoryLimit),

    // Firm memory — strictly firm-level: WHERE client_context_id IS NULL
    // This is firm knowledge shared across all clients (brand voice, processes)
    (db as any)
      .select({
        id:        memoryEntries.id,
        content:   memoryEntries.content,
        source:    (memoryEntries as any).source,
        createdAt: memoryEntries.createdAt,
      })
      .from(memoryEntries)
      .where(and(
        eq(memoryEntries.companyId, companyId),
        isNull((memoryEntries as any).clientContextId),  // ISOLATION: firm-level only
      ))
      .orderBy(desc(memoryEntries.createdAt))
      .limit(memoryLimit),

    // Client skill overlay (may be null — overlay is additive, never required)
    skillId ? (db as any)
      .select()
      .from(clientSkillOverlays)
      .where(and(
        eq(clientSkillOverlays.companyId, companyId),
        eq(clientSkillOverlays.clientContextId, clientContextId),
        eq(clientSkillOverlays.skillId, skillId),
      ))
      .limit(1) : Promise.resolve([]),
  ]);

  logger.debug(
    { companyId, clientContextId, clientMemory: clientMemoryRows.length, firmMemory: firmMemoryRows.length },
    "client-assembly: context assembled",
  );

  return {
    firmDna:       firmDnaRows[0] ?? null,
    clientDna:     clientDnaRows[0]?.clientDna ?? null,
    clientMemory:  clientMemoryRows,
    firmMemory:    firmMemoryRows,
    clientOverlay: overlayRows[0] ?? null,
  };
}

// ── formatContextBlock ────────────────────────────────────────────────────────

/**
 * Format the assembled context as a prompt block for injection.
 * Merge order: firmDNA → clientDNA → firmMemory → clientMemory
 */
export function formatContextBlock(ctx: ClientAssemblyContext, clientName: string): string {
  const lines: string[] = [];

  if (ctx.firmDna) {
    lines.push("## Contexte de l'agence");
    lines.push(JSON.stringify(ctx.firmDna));
  }

  if (ctx.clientDna) {
    lines.push(`\n## Client : ${clientName}`);
    lines.push(JSON.stringify(ctx.clientDna));
  }

  if (ctx.firmMemory.length > 0) {
    lines.push("\n## Mémoire de l'agence");
    ctx.firmMemory.forEach((m) => lines.push(`- ${m.content}`));
  }

  if (ctx.clientMemory.length > 0) {
    lines.push(`\n## Mémoire client : ${clientName}`);
    ctx.clientMemory.forEach((m) => lines.push(`- ${m.content}`));
  }

  if (ctx.clientOverlay) {
    if (ctx.clientOverlay.additionalSoulInstructions) {
      lines.push(`\n## Instructions spécifiques ${clientName}`);
      lines.push(ctx.clientOverlay.additionalSoulInstructions);
    }
    if (ctx.clientOverlay.sectorVocabulary.length > 0) {
      lines.push(`\n## Vocabulaire secteur ${clientName}`);
      lines.push(ctx.clientOverlay.sectorVocabulary.join(", "));
    }
  }

  return lines.join("\n");
}
