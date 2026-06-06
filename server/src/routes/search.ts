/**
 * server/src/routes/search.ts
 *
 * Full company search — spanning issues, documents, agents, comments.
 * Uses PostgreSQL trigram similarity (pg_trgm) for fuzzy matching.
 *
 * GET /companies/:companyId/search?q=...&limit=20
 *
 * Returns up to `limit` results across all entity types, ranked by
 * similarity score descending. Each result has: type, id, title,
 * snippet (highlighted excerpt), url.
 */

import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issues, documents, agents, issueComments, activityLog } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import pino from "pino";

const logger = pino({ name: "search" });

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;
const MIN_SIM       = 0.05; // trigram similarity threshold

export function searchRoutes(db: Db): Router {
  const router = Router();

  /**
   * GET /companies/:companyId/search?q=query&limit=20
   * Returns mixed results: issues, documents, agents, comments
   */
  router.get("/companies/:companyId/search", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      const q     = ((req.query.q as string) ?? "").trim();
      const limit = Math.min(
        parseInt((req.query.limit as string) ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
        MAX_LIMIT,
      );

      if (q.length < 2) {
        res.json({ ok: true, results: [], query: q });
        return;
      }

      logger.info({ companyId, q, limit }, "search: executing");

      // ── 1. Issues (title + identifier + description) ──────────────────────
      const issueResults = await (db as any)
        .select({
          id:         issues.id,
          title:      issues.title,
          identifier: issues.identifier,
          status:     issues.status,
          similarity: sql<number>`GREATEST(
            similarity(${issues.title}, ${q}),
            similarity(coalesce(${issues.identifier}, ''), ${q}),
            similarity(coalesce(${issues.description}, ''), ${q})
          )`,
        })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            sql`(
              ${issues.title} % ${q}
              OR coalesce(${issues.identifier}, '') % ${q}
              OR coalesce(${issues.description}, '') % ${q}
            )`,
          ),
        )
        .orderBy(desc(sql`GREATEST(
          similarity(${issues.title}, ${q}),
          similarity(coalesce(${issues.identifier}, ''), ${q}),
          similarity(coalesce(${issues.description}, ''), ${q})
        )`))
        .limit(limit);

      // ── 2. Documents (title + content) ────────────────────────────────────
      const docResults = await (db as any)
        .select({
          id:         documents.id,
          title:      documents.title,
          similarity: sql<number>`similarity(coalesce(${documents.title}, ''), ${q})`,
        })
        .from(documents)
        .where(
          and(
            eq(documents.companyId, companyId),
            sql`coalesce(${documents.title}, '') % ${q}`,
          ),
        )
        .orderBy(desc(sql`similarity(coalesce(${documents.title}, ''), ${q})`))
        .limit(limit);

      // ── 3. Agents (name + description) ───────────────────────────────────
      const agentResults = await (db as any)
        .select({
          id:          agents.id,
          name:        agents.name,
          displayName: agents.displayName,
          status:      agents.status,
          colour:      agents.colour,
          similarity:  sql<number>`similarity(${agents.name}, ${q})`,
        })
        .from(agents)
        .where(
          and(
            eq(agents.companyId, companyId),
            sql`${agents.name} % ${q}`,
          ),
        )
        .orderBy(desc(sql`similarity(${agents.name}, ${q})`))
        .limit(8);

      // ── 4. Comments (content snippet) ─────────────────────────────────────
      const commentResults = await (db as any)
        .select({
          id:       issueComments.id,
          issueId:  issueComments.issueId,
          content:  issueComments.body,
          similarity: sql<number>`similarity(${issueComments.body}, ${q})`,
        })
        .from(issueComments)
        .where(
          and(
            eq(issueComments.companyId, companyId),
            sql`${issueComments.body} % ${q}`,
          ),
        )
        .orderBy(desc(sql`similarity(${issueComments.body}, ${q})`))
        .limit(8);

      // ── Merge + rank ──────────────────────────────────────────────────────

      type SearchResult = {
        type:       "issue" | "document" | "agent" | "comment";
        id:         string;
        title:      string;
        snippet?:   string;
        url:        string;
        meta?:      string;
        similarity: number;
      };

      const results: SearchResult[] = [
        ...issueResults
          .filter((r: any) => r.similarity >= MIN_SIM)
          .map((r: any) => ({
            type:       "issue" as const,
            id:         r.id,
            title:      r.title,
            snippet:    r.identifier ?? undefined,
            url:        `/issues/${r.id}`,
            meta:       r.status,
            similarity: Number(r.similarity),
          })),

        ...docResults
          .filter((r: any) => r.similarity >= MIN_SIM)
          .map((r: any) => ({
            type:       "document" as const,
            id:         r.id,
            title:      r.title ?? "Untitled document",
            url:        `/documents/${r.id}`,
            similarity: Number(r.similarity),
          })),

        ...agentResults
          .filter((r: any) => r.similarity >= MIN_SIM)
          .map((r: any) => ({
            type:       "agent" as const,
            id:         r.id,
            title:      r.displayName ?? r.name,
            meta:       r.status,
            url:        `/team`,
            similarity: Number(r.similarity),
          })),

        ...commentResults
          .filter((r: any) => r.similarity >= MIN_SIM)
          .map((r: any) => ({
            type:       "comment" as const,
            id:         r.id,
            title:      r.content.slice(0, 80) + (r.content.length > 80 ? "…" : ""),
            url:        `/issues/${r.issueId}`,
            similarity: Number(r.similarity),
          })),
      ]
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      logger.info({ companyId, q, count: results.length }, "search: done");
      res.json({ ok: true, results, query: q });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
