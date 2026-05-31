/**
 * server/src/middleware/rate-limit.ts
 *
 * P3 — Three-tier rate limiting.
 *
 * Tier 1 — Per-IP:      1 000 req/hour  (blocks bots and scrapers)
 * Tier 2 — Per-user:    100 req/minute  (blocks brute force on authenticated routes)
 * Tier 3 — Per-company: 10 000 req/hour (prevents tenant abuse at scale)
 * Auth tier — Per-IP:   20 attempts/15 minutes (stricter on auth endpoints)
 *
 * Implementation: in-memory sliding window (no Redis dep for rate limiting).
 * For distributed deployment: swap SlidingWindow for a Redis-backed store.
 */

import type { RequestHandler } from "express";

interface RateLimitEntry {
  timestamps: number[];
}

class SlidingWindow {
  private readonly store = new Map<string, RateLimitEntry>();
  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const entry = this.store.get(key) ?? { timestamps: [] };

    // Remove expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    entry.timestamps.push(now);
    this.store.set(key, entry);

    return entry.timestamps.length <= this.maxRequests;
  }

  // Periodic cleanup to prevent memory leak in long-running process
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.timestamps.every((t) => now - t > this.windowMs)) {
        this.store.delete(key);
      }
    }
  }
}

// ── Rate limit windows ────────────────────────────────────────────────────────

const ipWindow      = new SlidingWindow(3_600_000, 1_000);   // 1h, 1000 req
const userWindow    = new SlidingWindow(60_000,    100);      // 1m, 100 req
const companyWindow = new SlidingWindow(3_600_000, 10_000);   // 1h, 10000 req
const authWindow    = new SlidingWindow(900_000,   20);       // 15m, 20 req

// Cleanup every 5 minutes
setInterval(() => {
  ipWindow.cleanup();
  userWindow.cleanup();
  companyWindow.cleanup();
  authWindow.cleanup();
}, 5 * 60_000).unref();

// ── Middleware ────────────────────────────────────────────────────────────────

function getClientIp(req: any): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket?.remoteAddress ??
    "unknown"
  );
}

/**
 * Standard three-tier rate limiting for all API routes.
 */
export const rateLimitMiddleware: RequestHandler = (req, res, next) => {
  const ip        = getClientIp(req);
  const userId    = (req as any).ctx?.userId as string | undefined;
  const companyId = (req as any).ctx?.companyId as string | undefined;

  // Tier 1: per-IP
  if (!ipWindow.isAllowed(ip)) {
    res.status(429).json({ ok: false, error: { code: "RATE_LIMITED_IP", message: "Trop de requêtes. Réessayez dans une heure." } });
    return;
  }

  // Tier 2: per-user (authenticated routes only)
  if (userId && !userWindow.isAllowed(userId)) {
    res.status(429).json({ ok: false, error: { code: "RATE_LIMITED_USER", message: "Trop de requêtes. Réessayez dans une minute." } });
    return;
  }

  // Tier 3: per-company
  if (companyId && !companyWindow.isAllowed(companyId)) {
    res.status(429).json({ ok: false, error: { code: "RATE_LIMITED_COMPANY", message: "Limite de requêtes atteinte. Réessayez dans une heure." } });
    return;
  }

  next();
};

/**
 * Stricter rate limit for authentication endpoints.
 * 20 attempts per IP per 15 minutes — blocks credential stuffing.
 */
export const authRateLimitMiddleware: RequestHandler = (req, res, next) => {
  const ip = getClientIp(req);
  if (!authWindow.isAllowed(ip)) {
    res.status(429).json({ ok: false, error: { code: "RATE_LIMITED_AUTH", message: "Trop de tentatives. Réessayez dans 15 minutes." } });
    return;
  }
  next();
};
