/**
 * server/src/memory/service.ts
 *
 * Org memory service — M8 implementation.
 *
 * Exports:
 *   storeMemory()          — embed + write to memory_entries
 *   searchMemory()         — pgvector cosine similarity > 0.72
 *   buildContactProfile()  — formats contact + events + notes into context text
 *   injectContactProfile() — extracts name from query, returns profile or null
 *
 * The 0.72 cosine similarity threshold is the project standard (CLAUDE.md M8).
 * Entries below this threshold are not surfaced even if they exist.
 *
 * RULE 5: task content is never truncated — memory is compressed first.
 */
import { eq, and, desc, ilike } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { memoryEntries, contacts, contactEvents, contactNotes } from "@paperclipai/db";
import { embedText } from "./embed.js";
import { estimateTokens } from "../context/tokens.js";
// ── Constants ─────────────────────────────────────────────────────────────────
export const SIMILARITY_THRESHOLD = 0.72;
const MAX_EVENTS_PER_CONTACT = 5;
const MAX_NOTES_PER_CONTACT = 3;
// ── Store ─────────────────────────────────────────────────────────────────────
/**
 * Generate an embedding for the memory entry and persist it.
 * Called by agents after completing a task with noteworthy outcomes.
 */
export async function storeMemory(db, params) {
    const embedding = await embedText(`${params.title}: ${params.content}`);
    await db.insert(memoryEntries).values({
        companyId: params.companyId,
        agentId: params.agentId ?? null,
        title: params.title,
        content: params.content,
        importance: params.importance,
        embedding,
    });
}
// ── Search ────────────────────────────────────────────────────────────────────
/**
 * Semantic search over org memory using pgvector cosine similarity.
 * Only entries with similarity > SIMILARITY_THRESHOLD (0.72) are returned.
 *
 * Falls back to empty result (no crash) if embedding column is null on a row.
 */
export async function searchMemory(db, params) {
    const queryEmbedding = await embedText(params.query);
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    // Raw SQL needed for pgvector <=> cosine distance operator
    const rows = await db.execute(sql `
    SELECT
      id,
      title,
      content,
      importance,
      CAST(1 - (embedding <=> ${sql.raw(`'${vectorLiteral}'`)}::vector) AS float8) AS similarity
    FROM memory_entries
    WHERE company_id  = ${params.companyId}
      AND archived    = false
      AND embedding   IS NOT NULL
    ORDER BY embedding <=> ${sql.raw(`'${vectorLiteral}'`)}::vector
    LIMIT ${params.maxChunks * 2}
  `);
    // Application-level threshold guard (belt + braces over the SQL ordering)
    const relevant = (Array.isArray(rows) ? rows : rows.rows ?? [])
        .map((r) => ({ ...r, similarity: Number(r.similarity) }))
        .filter((r) => r.similarity > SIMILARITY_THRESHOLD)
        .slice(0, params.maxChunks);
    // Build context text within token budget (RULE 5: compress memory, never task)
    let text = "";
    let chunksUsed = 0;
    for (const chunk of relevant) {
        if (chunksUsed >= params.maxChunks)
            break;
        const chunkText = `[Memory] ${chunk.title}: ${chunk.content}\n`;
        if (estimateTokens(text + chunkText) > params.maxTokens)
            break;
        text += chunkText;
        chunksUsed++;
    }
    return { text, chunksUsed };
}
// ── Contact profile ───────────────────────────────────────────────────────────
/**
 * Build a formatted contact profile for injection into Layer 4 context.
 * Returns empty string if the contact is not found.
 */
export async function buildContactProfile(db, companyId, contactName) {
    // Case-insensitive name lookup
    const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.companyId, companyId), ilike(contacts.fullName, `%${contactName}%`)))
        .limit(1);
    if (!contact)
        return "";
    // Recent events
    const events = await db
        .select()
        .from(contactEvents)
        .where(eq(contactEvents.contactId, contact.id))
        .orderBy(desc(contactEvents.occurredAt))
        .limit(MAX_EVENTS_PER_CONTACT);
    // Agent notes
    const notes = await db
        .select()
        .from(contactNotes)
        .where(eq(contactNotes.contactId, contact.id))
        .orderBy(desc(contactNotes.createdAt))
        .limit(MAX_NOTES_PER_CONTACT);
    const lines = [
        `[Contact: ${contact.fullName}]`,
    ];
    if (contact.role)
        lines.push(`Role: ${contact.role}`);
    if (contact.organisation)
        lines.push(`Organisation: ${contact.organisation}`);
    if (contact.email)
        lines.push(`Email: ${contact.email}`);
    if (contact.notes)
        lines.push(`Background: ${contact.notes}`);
    if (events.length > 0) {
        lines.push("Recent interactions:");
        for (const e of events) {
            const date = new Date(e.occurredAt).toISOString().slice(0, 10);
            lines.push(`  ${date} [${e.eventType}] ${e.summary}`);
        }
    }
    if (notes.length > 0) {
        lines.push("Agent notes:");
        for (const n of notes) {
            lines.push(`  - ${n.content}`);
        }
    }
    return lines.join("\n");
}
/**
 * Contact injection trigger — M8.
 *
 * Scans the query text for potential contact names (capitalised 2+ word groups)
 * and returns the first matching contact profile from the DB.
 *
 * Returns null when no contact is found (no injection).
 */
export async function injectContactProfile(db, companyId, query) {
    // Extract candidate names: sequences of 2–4 capitalised words
    const namePattern = /\b([A-ZÀÂÇÉÈÊËÎÏÔÙÛÜ][a-zàâçéèêëîïôùûü]+(?:\s+[A-ZÀÂÇÉÈÊËÎÏÔÙÛÜ][a-zàâçéèêëîïôùûü]+){1,3})\b/g;
    const candidates = [...query.matchAll(namePattern)].map((m) => m[1]);
    for (const name of candidates) {
        const profile = await buildContactProfile(db, companyId, name);
        if (profile)
            return profile;
    }
    return null;
}
//# sourceMappingURL=service.js.map