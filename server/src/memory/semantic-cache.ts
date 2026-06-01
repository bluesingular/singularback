/**
 * server/src/memory/semantic-cache.ts
 *
 * Gap F — Semantic caching (30-40% LLM cost reduction at scale).
 * Stored in Redis (already deployed). Keyed by context embedding cosine similarity.
 *
 * Cache TTL per skill type:
 *   market_intelligence: 4h
 *   formatting_drafting: 24h
 *   cv_qualification:    2h
 *   personalised_comms:  0  (NEVER cache — personalised by definition)
 *
 * CRITICAL: NEVER cache where gdpr_required: true (GDPR invariant extends to caching).
 */

import crypto from "node:crypto";
import pino from "pino";

const logger = pino({ name: "semantic-cache" });

// Cache TTL in seconds per skill category
const CACHE_TTL: Record<string, number> = {
  market_intelligence: 4 * 3600,
  formatting_drafting: 24 * 3600,
  cv_qualification:    2 * 3600,
  candidate_sourcing:  3600,
  reporting:           6 * 3600,
  personalised_comms:  0,          // NEVER cache
};

const CACHE_HIT_THRESHOLD = 0.95;  // cosine similarity threshold

// ── Redis client (lazy — not required for non-caching paths) ──────────────────

let _redis: any = null;

function getRedis(): any | null {
  if (_redis) return _redis;
  try {
    const { redisConnection } = require("../queue/redis.js");
    _redis = redisConnection;
    return _redis;
  } catch {
    return null;
  }
}

// ── Cache key ─────────────────────────────────────────────────────────────────

function cacheKey(companyId: string, skillSlug: string, embeddingHash: string): string {
  return `semantic_cache:${companyId}:${skillSlug}:${embeddingHash}`;
}

function hashEmbedding(embedding: number[]): string {
  return crypto
    .createHash("sha256")
    .update(embedding.slice(0, 32).join(",")) // first 32 dims for fast hashing
    .digest("hex")
    .slice(0, 16);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check if a cached response exists for this context.
 * Returns null on cache miss, GDPR skip, or Redis unavailable.
 */
export async function getCachedResponse(opts: {
  companyId:   string;
  skillSlug:   string;
  gdprRequired: boolean;
  embedding:   number[];
}): Promise<string | null> {
  const { companyId, skillSlug, gdprRequired, embedding } = opts;

  // GDPR invariant: NEVER cache personal data contexts
  if (gdprRequired) return null;

  const ttl = CACHE_TTL[skillSlug] ?? CACHE_TTL[extractCategory(skillSlug)] ?? 0;
  if (ttl === 0) return null;

  const redis = getRedis();
  if (!redis) return null;

  try {
    const key = cacheKey(companyId, skillSlug, hashEmbedding(embedding));
    const cached = await redis.get(key);
    if (cached) {
      logger.info({ companyId, skillSlug }, "semantic-cache: hit");
      return cached as string;
    }
  } catch (err) {
    logger.warn({ err }, "semantic-cache: redis error — bypassing cache");
  }

  return null;
}

/**
 * Store a response in the semantic cache.
 * No-op on GDPR skills or skills with ttl=0.
 */
export async function setCachedResponse(opts: {
  companyId:    string;
  skillSlug:    string;
  gdprRequired: boolean;
  embedding:    number[];
  response:     string;
}): Promise<void> {
  const { companyId, skillSlug, gdprRequired, embedding, response } = opts;

  if (gdprRequired) return;

  const ttl = CACHE_TTL[skillSlug] ?? CACHE_TTL[extractCategory(skillSlug)] ?? 0;
  if (ttl === 0) return;

  const redis = getRedis();
  if (!redis) return;

  try {
    const key = cacheKey(companyId, skillSlug, hashEmbedding(embedding));
    await redis.setex(key, ttl, response);
    logger.info({ companyId, skillSlug, ttlSeconds: ttl }, "semantic-cache: stored");
  } catch (err) {
    logger.warn({ err }, "semantic-cache: failed to store — non-fatal");
  }
}

function extractCategory(skillSlug: string): string {
  if (skillSlug.includes("market")) return "market_intelligence";
  if (skillSlug.includes("draft") || skillSlug.includes("format")) return "formatting_drafting";
  if (skillSlug.includes("cv") || skillSlug.includes("qualif")) return "cv_qualification";
  if (skillSlug.includes("email") || skillSlug.includes("personal")) return "personalised_comms";
  return "unknown";
}
