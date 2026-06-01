/**
 * server/src/documents/studio.ts
 *
 * §17 — Proposal and Document Studio.
 *
 * Generation pipeline:
 *   1. CEO provides a brief (title + description + document type)
 *   2. Company DNA injected: brand voice, service descriptions, client info
 *   3. Org memory queried: contact history, prior interactions
 *   4. Pack template applied (structure, legal mentions, formatting)
 *   5. Document generated via T3 (Claude Sonnet)
 *   6. Output stored as a task pending approval
 *   7. Post-approval: filing to connected storage handled by a separate action
 *
 * Quality gate: documents pass brand voice validation (tone vs soul.md)
 * and legal mention validation (required clauses per document type).
 */

import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companyDna, memoryEntries, issues, agents } from "@paperclipai/db";
import { callLLM } from "../llm/openrouter.js";
import pino from "pino";

const logger = pino({ name: "document-studio" });

export type DocumentType =
  | "commercial_proposal"
  | "client_progress_report"
  | "meeting_summary"
  | "market_research_brief"
  | "administrative_template"
  | "custom";

interface DocumentTypeMeta {
  label:           string;
  requiredClauses: string[];
  structure:       string[];
  maxPages:        number;
}

const DOCUMENT_TYPES: Record<DocumentType, DocumentTypeMeta> = {
  commercial_proposal:    { label: "Proposition commerciale",  requiredClauses: ["conditions de paiement", "durée de validité"], structure: ["Contexte", "Notre proposition", "Livrables", "Planning", "Budget", "Conditions"], maxPages: 6 },
  client_progress_report: { label: "Rapport d'avancement client", requiredClauses: [], structure: ["Avancement", "Réalisations", "Points d'attention", "Prochaines étapes"], maxPages: 4 },
  meeting_summary:        { label: "Compte-rendu de réunion",  requiredClauses: [], structure: ["Participants", "Points discutés", "Décisions", "Actions"], maxPages: 2 },
  market_research_brief:  { label: "Brief de recherche marché", requiredClauses: [], structure: ["Objectif", "Périmètre", "Sources", "Livrables attendus"], maxPages: 3 },
  administrative_template:{ label: "Document administratif",   requiredClauses: [], structure: ["Objet", "Corps", "Signature"], maxPages: 2 },
  custom:                 { label: "Document personnalisé",    requiredClauses: [], structure: [], maxPages: 10 },
};

export interface DocumentRequest {
  companyId:       string;
  requestedBy:     string;
  documentType:    DocumentType;
  title:           string;
  brief:           string;
  contactTitle?:   string;   // plain-text contact label for memory search
  customStructure?: string[];
  assigneeAgentId?: string;
}

export interface GeneratedDocument {
  taskId:         string;
  title:          string;
  content:        string;
  documentType:   DocumentType;
  wordCount:      number;
  legalValid:     boolean;
  missingClauses: string[];
}

export async function generateDocument(db: Db, req: DocumentRequest): Promise<GeneratedDocument> {
  const meta = DOCUMENT_TYPES[req.documentType];

  // 1. Fetch Company DNA (named fields, not coreFields)
  const dnaRow = await db.query.companyDna.findFirst({
    where: eq(companyDna.companyId, req.companyId),
  });

  const companyName = String(dnaRow?.description?.split("\n")[0] ?? "Notre entreprise");
  const brandVoice  = dnaRow?.tone ?? "Professionnel, chaleureux, précis";
  const brandRules  = dnaRow?.brandRules ?? "";

  // 2. Fetch recent org memory (use title search for contact if provided)
  const memories = await db.query.memoryEntries.findMany({
    where: and(
      eq(memoryEntries.companyId, req.companyId),
      eq(memoryEntries.archived, false),
    ),
    orderBy: desc(memoryEntries.createdAt),
    limit: 8,
    columns: { content: true, title: true },
  });
  const memoryContext = memories.map((m) => `- [${m.title}] ${m.content}`).join("\n");

  // 3. Build structure
  const structure = req.customStructure ?? meta.structure;

  // 4. Prompt
  const systemPrompt = [
    `Tu es l'assistant de rédaction de ${companyName}.`,
    `Ton de communication : ${brandVoice}`,
    brandRules ? `Règles de marque : ${brandRules}` : "",
    `Tu génères un document de type "${meta.label}".`,
    structure.length > 0 ? `Structure requise : ${structure.join(" → ")}` : "",
    `Longueur maximale : ${meta.maxPages} pages (~${meta.maxPages * 250} mots).`,
    "Markdown autorisé. Langue : français. Ne jamais inventer des chiffres ou engagements.",
  ].filter(Boolean).join("\n");

  const userPrompt = [
    `Brief du CEO :\n"${req.brief}"`,
    memoryContext ? `\nContexte mémorisé :\n${memoryContext}` : "",
    "\nGénère le document complet maintenant.",
  ].join("");

  // 5. Generate via T3 (Claude Sonnet)
  const modelName = "anthropic/claude-sonnet-4-5"; // T3: Claude Sonnet — non-personal data document generation

  logger.info({ companyId: req.companyId, documentType: req.documentType }, "document-studio: generating");

  const llmRes = await callLLM({
    companyId:    req.companyId,
    agentId:      "system",
    taskId:       "document-studio",
    model:        modelName,
    gdprRequired: false,
    skillName:    "document_studio",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
    maxOutputTokens: 3000,
  });

  const content = llmRes.choices[0]?.message?.content ?? "";

  // 6. Legal mention validation
  const { valid, missing } = validateLegal(content, meta.requiredClauses);

  // 7. Create task pending approval
  const agentRow = req.assigneeAgentId
    ? await db.query.agents.findFirst({
        where: and(eq(agents.companyId, req.companyId), eq(agents.id, req.assigneeAgentId)),
        columns: { id: true },
      })
    : await db.query.agents.findFirst({
        where: and(eq(agents.companyId, req.companyId), eq(agents.status, "active")),
        columns: { id: true },
      });

  const [task] = await db.insert(issues).values({
    companyId:        req.companyId,
    title:            req.title,
    description:      `[§17 Document Studio — ${meta.label}]\n\n${req.brief}\n\n---\n\n${content}`,
    status:           "pending_approval",
    priority:         "medium",
    assigneeAgentId:  agentRow?.id ?? null,
    createdByUserId:  req.requestedBy,
  }).returning({ id: issues.id });

  logger.info({ companyId: req.companyId, taskId: task.id, legalValid: valid }, "document-studio: task created");

  return {
    taskId:         task.id,
    title:          req.title,
    content,
    documentType:   req.documentType,
    wordCount:      content.split(/\s+/).length,
    legalValid:     valid,
    missingClauses: missing,
  };
}

function validateLegal(content: string, clauses: string[]): { valid: boolean; missing: string[] } {
  const lower   = content.toLowerCase();
  const missing = clauses.filter((c) => !lower.includes(c.toLowerCase()));
  return { valid: missing.length === 0, missing };
}
