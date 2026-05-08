/**
 * G12 — MCP Server HTTP route.
 *
 * POST /mcp/:companyId
 *   Content-Type: application/json
 *   Authorization: Bearer <mcp-api-key>
 *
 *   Body: JSON-RPC 2.0 request
 *   Response: JSON-RPC 2.0 response (always HTTP 200)
 *
 * Key management routes (operator+):
 *   POST   /companies/:companyId/mcp/keys         → create key (returns raw key once)
 *   DELETE /companies/:companyId/mcp/keys/:keyId  → revoke key
 *   GET    /companies/:companyId/mcp/keys          → list keys (hashes only, never raw)
 */

import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { mcpApiKeys } from "@paperclipai/db";
import { eq, and, isNull } from "drizzle-orm";
import { assertCompanyAccess, requireRole } from "./authz.js";
import { notFound, badRequest } from "../errors.js";
import { handleJsonRpc } from "../mcp/server.js";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function mcpServerRoutes(db: Db): Router {
  const router = Router({ mergeParams: true });

  // ── MCP JSON-RPC endpoint ─────────────────────────────────────────────────
  router.post("/mcp/:companyId", async (req, res) => {
    const { companyId } = req.params;

    // Authenticate via Bearer token
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      res.status(401).json({ error: "Missing Authorization: Bearer <mcp-api-key>" });
      return;
    }

    const keyHash = hashKey(token);
    const [keyRow] = await (db as any)
      .select({ id: mcpApiKeys.id, companyId: mcpApiKeys.companyId })
      .from(mcpApiKeys)
      .where(
        and(
          eq(mcpApiKeys.keyHash,    keyHash),
          eq(mcpApiKeys.companyId,  companyId),
          isNull(mcpApiKeys.revokedAt),
        ),
      );

    if (!keyRow) {
      res.status(401).json({ error: "Invalid or revoked API key" });
      return;
    }

    // Update last_used_at (fire-and-forget)
    (db as any)
      .update(mcpApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(mcpApiKeys.id, keyRow.id))
      .catch(() => {});

    const response = await handleJsonRpc(db, companyId, req.body);
    res.json(response);
  });

  // ── Key management ────────────────────────────────────────────────────────

  router.post("/companies/:companyId/mcp/keys", async (req, res, next) => {
    try {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const name = req.body?.name;
      if (!name || typeof name !== "string") throw badRequest("name is required");

      const rawKey = `swm_${randomBytes(32).toString("hex")}`;
      const keyHash = hashKey(rawKey);

      const [row] = await (db as any)
        .insert(mcpApiKeys)
        .values({ companyId, name, keyHash })
        .returning({ id: mcpApiKeys.id, name: mcpApiKeys.name, createdAt: mcpApiKeys.createdAt });

      // Raw key returned once only — never stored
      res.status(201).json({ ok: true, key: rawKey, id: row.id, name: row.name, createdAt: row.createdAt });
    } catch (err) {
      next(err);
    }
  });

  router.get("/companies/:companyId/mcp/keys", async (req, res, next) => {
    try {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const rows = await (db as any)
        .select({
          id:         mcpApiKeys.id,
          name:       mcpApiKeys.name,
          lastUsedAt: mcpApiKeys.lastUsedAt,
          revokedAt:  mcpApiKeys.revokedAt,
          createdAt:  mcpApiKeys.createdAt,
        })
        .from(mcpApiKeys)
        .where(eq(mcpApiKeys.companyId, companyId));

      res.json({ keys: rows });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/companies/:companyId/mcp/keys/:keyId", async (req, res, next) => {
    try {
      const { companyId, keyId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const [row] = await (db as any)
        .update(mcpApiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(mcpApiKeys.id, keyId), eq(mcpApiKeys.companyId, companyId), isNull(mcpApiKeys.revokedAt)))
        .returning({ id: mcpApiKeys.id });

      if (!row) throw notFound("API key not found or already revoked");
      res.json({ ok: true, id: row.id });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
