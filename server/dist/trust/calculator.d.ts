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
export declare const TRUST_WEIGHTS: {
    readonly qualityRating: 0.5;
    readonly gatePassRate: 0.3;
    readonly schemaPassRate: 0.2;
    readonly windowDays: 30;
};
export type AutonomyLevel = "building" | "supervised" | "trusted" | "highlyTrusted";
export declare const AUTONOMY_THRESHOLDS: Record<AutonomyLevel, {
    min: number;
    max: number;
}>;
export declare const LEVEL_ORDER: AutonomyLevel[];
export interface TrustScoreParams {
    qualityRatingAvg: number;
    gatePassRate: number;
    schemaPassRate: number;
}
/**
 * Calculate the weighted trust score (0.0–5.0).
 * Result is rounded to 2 decimal places and clamped [0, 5].
 */
export declare function calculateTrustScore(params: TrustScoreParams): number;
/**
 * Derive the autonomy level from a trust score.
 */
export declare function getAutonomyLevel(score: number): AutonomyLevel;
/**
 * Return true if `newLevel` represents a downgrade from `currentLevel`.
 */
export declare function isDowngrade(currentLevel: AutonomyLevel, newLevel: AutonomyLevel): boolean;
/**
 * Return the next level up from the given level, or null if already at max.
 */
export declare function nextLevel(level: AutonomyLevel): AutonomyLevel | null;
//# sourceMappingURL=calculator.d.ts.map