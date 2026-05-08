/**
 * G13 — Public API authentication + rate limiting middleware.
 *
 * Validates Bearer token against public_api_keys table.
 * Enforces sliding-window rate limit (default 1 000 req / hour per key).
 * On success injects: req.publicApiCompanyId, req.publicApiKeyId, req.publicApiScope.
 */

import { createHash } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { publicApiKeys } from "@paperclipai/db";

// ── Rate limit store (in-memory sliding window) ───────────────────────────────

interface RateLimitBucket {
  timestamps: number[]; // epoch-ms of each request
}

const rateLimitStore = new Map<string, RateLimitBucket>();

function checkRateLimit(keyId: string, limitPerHour: number): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1_000; // 1 hour
  const bucket = rateLimitStore.get(keyId) ?? { timestamps: [] };

  // Evict timestamps older than the window
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limitPerHour) {
    rateLimitStore.set(keyId, bucket);
    return false; // exceeded
  }

  bucket.timestamps.push(now);
  rateLimitStore.set(keyId, bucket);
  return true;
}

// Exposed for testing
export { checkRateLimit, rateLimitStore };

// ── Token hashing ─────────────────────────────────────────────────────────────

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// ── Augmented request types ───────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      publicApiCompanyId?: string;
      publicApiKeyId?: string;
      publicApiScope?: string;
    }
  }
}

// ── Middleware factory ────────────────────────────────────────────────────────

export function publicApiAuth(db: Db): RequestHandler {
  return async (req: Request, res, next) => {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token) {
      res.status(401).json({ error: "Missing Authorization: Bearer <api-key>" });
      return;
    }

    const keyHash = hashApiKey(token);

    const [keyRow] = await (db as any)
      .select({
        id:               publicApiKeys.id,
        companyId:        publicApiKeys.companyId,
        scope:            publicApiKeys.scope,
        rateLimitPerHour: publicApiKeys.rateLimitPerHour,
      })
      .from(publicApiKeys)
      .where(
        and(
          eq(publicApiKeys.keyHash, keyHash),
          isNull(publicApiKeys.revokedAt),
        ),
      );

    if (!keyRow) {
      res.status(401).json({ error: "Invalid or revoked API key" });
      return;
    }

    if (!checkRateLimit(keyRow.id, keyRow.rateLimitPerHour)) {
      res.status(429).json({ error: "Rate limit exceeded. Retry after one hour." });
      return;
    }

    // Fire-and-forget lastUsedAt update
    (db as any)
      .update(publicApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(publicApiKeys.id, keyRow.id))
      .catch(() => {});

    req.publicApiCompanyId = keyRow.companyId;
    req.publicApiKeyId = keyRow.id;
    req.publicApiScope = keyRow.scope;

    next();
  };
}
