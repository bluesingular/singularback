/**
 * server/src/context/dna.ts
 *
 * Company DNA service — reads and formats the company's identity data
 * for injection into agent context (Layer 2 of assembleContext).
 *
 * Two variants:
 *   - getDnaCompressed: ~300 tokens, for T0/T1 models with tight budgets
 *   - getDnaFull:       ~2000 tokens, for T2+ models with richer context
 */

import { eq } from "drizzle-orm";
import { companyDna } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";

export interface DnaRecord {
  description: string;
  customerProfile: string;
  tone: string;
  brandRules: string;
  regulatoryContext: string;
  forbiddenTopics: string[];
  terminology: Record<string, string>;
  competitors: string[];
}

/**
 * Fetch raw DNA record for a company. Returns null if no DNA has been
 * configured yet (new company, onboarding not complete).
 */
export async function getDna(db: Db, companyId: string): Promise<DnaRecord | null> {
  const [row] = await db
    .select()
    .from(companyDna)
    .where(eq(companyDna.companyId, companyId))
    .limit(1);

  if (!row) return null;

  return {
    description: row.description,
    customerProfile: row.customerProfile,
    tone: row.tone,
    brandRules: row.brandRules,
    regulatoryContext: row.regulatoryContext,
    forbiddenTopics: row.forbiddenTopics ?? [],
    terminology: (row.terminology as Record<string, string>) ?? {},
    competitors: row.competitors ?? [],
  };
}

/**
 * Short DNA summary for T0/T1 context — approximately 300 tokens.
 * Covers the essentials: identity, audience, tone, hard limits.
 */
export async function getDnaCompressed(db: Db, companyId: string): Promise<string> {
  const dna = await getDna(db, companyId);
  if (!dna) return "";

  const parts: string[] = [];
  if (dna.description) parts.push(`Company: ${dna.description}`);
  if (dna.customerProfile) parts.push(`Customers: ${dna.customerProfile}`);
  if (dna.tone) parts.push(`Tone: ${dna.tone}`);
  if (dna.forbiddenTopics.length > 0) {
    parts.push(`Never write about: ${dna.forbiddenTopics.join(", ")}`);
  }

  return parts.join("\n");
}

/**
 * Full DNA for T2/T3 context — approximately 2000 tokens.
 * Includes all fields as structured markdown for richer agent grounding.
 */
export async function getDnaFull(db: Db, companyId: string): Promise<string> {
  const dna = await getDna(db, companyId);
  if (!dna) return "";

  const sections: string[] = ["## Company Identity"];

  if (dna.description) sections.push(`**Description:** ${dna.description}`);
  if (dna.customerProfile) sections.push(`**Target customers:** ${dna.customerProfile}`);
  if (dna.tone) sections.push(`**Communication tone:** ${dna.tone}`);

  if (dna.brandRules) {
    sections.push("\n## Brand Rules");
    sections.push(dna.brandRules);
  }

  if (dna.regulatoryContext) {
    sections.push("\n## Regulatory Context");
    sections.push(dna.regulatoryContext);
  }

  if (dna.forbiddenTopics.length > 0) {
    sections.push("\n## Forbidden Topics");
    sections.push(dna.forbiddenTopics.map((t) => `- ${t}`).join("\n"));
  }

  const termEntries = Object.entries(dna.terminology);
  if (termEntries.length > 0) {
    sections.push("\n## Terminology");
    sections.push(termEntries.map(([term, def]) => `- **${term}**: ${def}`).join("\n"));
  }

  if (dna.competitors.length > 0) {
    sections.push("\n## Competitors (never mention positively)");
    sections.push(dna.competitors.map((c) => `- ${c}`).join("\n"));
  }

  return sections.join("\n");
}

/**
 * Upsert DNA for a company. Called from the Settings / Company DNA UI.
 */
export async function upsertDna(
  db: Db,
  companyId: string,
  data: Partial<Omit<DnaRecord, "forbiddenTopics" | "terminology" | "competitors">> & {
    forbiddenTopics?: string[];
    terminology?: Record<string, string>;
    competitors?: string[];
  },
  updatedBy?: string,
): Promise<void> {
  await db
    .insert(companyDna)
    .values({
      companyId,
      description: data.description ?? "",
      customerProfile: data.customerProfile ?? "",
      tone: data.tone ?? "professional",
      brandRules: data.brandRules ?? "",
      regulatoryContext: data.regulatoryContext ?? "",
      forbiddenTopics: data.forbiddenTopics ?? [],
      terminology: data.terminology ?? {},
      competitors: data.competitors ?? [],
      updatedBy: updatedBy ?? null,
    })
    .onConflictDoUpdate({
      target: companyDna.companyId,
      set: {
        ...data,
        updatedAt: new Date(),
        updatedBy: updatedBy ?? null,
      },
    });
}
