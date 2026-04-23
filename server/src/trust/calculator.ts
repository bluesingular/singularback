/**
 * server/src/trust/calculator.ts
 *
 * Trust Score calculation and autonomy level mapping.
 *
 * Trust Score formula (0.0–5.0):
 *   score = qualityRatingAvg × 0.50
 *         + gatePassRate     × 5 × 0.30   (normalised 0–1 → 0–5)
 *         + schemaPassRate   × 5 × 0.20   (normalised 0–1 → 0–5)
 *
 * The 5× normalisation ensures each factor contributes on the same 0–5 scale,
 * and the total maximum is exactly 5.0.
 *
 * Autonomy levels (CLAUDE.md AUTONOMY_THRESHOLDS):
 *   building      0.0 – 2.9  →  every task requires approval
 *   supervised    3.0 – 3.9  →  random spot-check reviews
 *   trusted       4.0 – 4.4  →  daily summaries, no per-task approval
 *   highlyTrusted 4.5 – 5.0  →  silent autonomy
 */

// ── Weights ───────────────────────────────────────────────────────────────────

export const TRUST_WEIGHTS = {
  qualityRating:  0.50,
  gatePassRate:   0.30,
  schemaPassRate: 0.20,
  windowDays:     30,
} as const;

// ── Autonomy ──────────────────────────────────────────────────────────────────

export type AutonomyLevel =
  | "building"
  | "supervised"
  | "trusted"
  | "highlyTrusted";

export const AUTONOMY_THRESHOLDS: Record<
  AutonomyLevel,
  { min: number; max: number }
> = {
  building:     { min: 0,   max: 2.9 },
  supervised:   { min: 3.0, max: 3.9 },
  trusted:      { min: 4.0, max: 4.4 },
  highlyTrusted: { min: 4.5, max: 5.0 },
};

// Level order (used for upgrade/downgrade comparisons)
export const LEVEL_ORDER: AutonomyLevel[] = [
  "building",
  "supervised",
  "trusted",
  "highlyTrusted",
];

// ── Score calculation ─────────────────────────────────────────────────────────

export interface TrustScoreParams {
  qualityRatingAvg: number; // 0–5 star average
  gatePassRate:     number; // 0–1 fraction of tasks where gates passed
  schemaPassRate:   number; // 0–1 fraction of tasks where schema passed
}

/**
 * Calculate the weighted trust score (0.0–5.0).
 * Result is rounded to 2 decimal places and clamped [0, 5].
 */
export function calculateTrustScore(params: TrustScoreParams): number {
  const { qualityRatingAvg, gatePassRate, schemaPassRate } = params;

  const raw =
    qualityRatingAvg * TRUST_WEIGHTS.qualityRating +
    gatePassRate     * 5 * TRUST_WEIGHTS.gatePassRate +
    schemaPassRate   * 5 * TRUST_WEIGHTS.schemaPassRate;

  return Math.min(5, Math.max(0, Math.round(raw * 100) / 100));
}

/**
 * Derive the autonomy level from a trust score.
 */
export function getAutonomyLevel(score: number): AutonomyLevel {
  if (score >= 4.5) return "highlyTrusted";
  if (score >= 4.0) return "trusted";
  if (score >= 3.0) return "supervised";
  return "building";
}

/**
 * Return true if `newLevel` represents a downgrade from `currentLevel`.
 */
export function isDowngrade(
  currentLevel: AutonomyLevel,
  newLevel: AutonomyLevel,
): boolean {
  return LEVEL_ORDER.indexOf(newLevel) < LEVEL_ORDER.indexOf(currentLevel);
}

/**
 * Return the next level up from the given level, or null if already at max.
 */
export function nextLevel(level: AutonomyLevel): AutonomyLevel | null {
  const idx = LEVEL_ORDER.indexOf(level);
  return idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : null;
}
