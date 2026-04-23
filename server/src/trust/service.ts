/**
 * server/src/trust/service.ts
 *
 * Trust calibration service — M9.
 *
 * recordApproval()     — called after each task approval rating is submitted.
 *                         Updates trust score, streak, and triggers proposals.
 * checkTrustDowngrade() — called after a gate violation or damage-control event.
 *                         Downgrades autonomy level if score dropped.
 *
 * RULE (Tier A, never auto-activates):
 *   When autonomyTier = "A", any autonomy upgrade MUST go through a human-approved
 *   trust_proposals record. The agent never gains autonomy automatically.
 *   When autonomyTier = "B", upgrades activate automatically when the streak fires.
 */

import { eq, and } from "drizzle-orm";
import { trustScores, trustProposals } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import {
  calculateTrustScore,
  getAutonomyLevel,
  isDowngrade,
  nextLevel,
  type AutonomyLevel,
} from "./calculator.js";
import pino from "pino";

const logger = pino({ name: "trust" });

export const STREAK_THRESHOLD = 10; // consecutive 4+★ approvals to trigger proposal

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecordApprovalParams {
  companyId:         string;
  agentId:           string;
  skillType:         string;
  /** From skill frontmatter — "A" requires human approval for any upgrade */
  skillAutonomyTier: "A" | "B";
  /** Star rating submitted by operator: 1–5 */
  rating:            number;
  /** Whether all quality gates passed for this task */
  gatePassed:        boolean;
  /** Whether output schema validation passed for this task */
  schemaPassed:      boolean;
  /** Rolling 30-day metrics (caller computes from audit log) */
  qualityRatingAvg:  number;
  gatePassRate:      number;
  schemaPassRate:    number;
  taskCountWindow:   number;
  /** Current streak from the trust_scores row (0 if first task) */
  currentStreak:     number;
  /** Current autonomy level from the trust_scores row */
  currentLevel:      AutonomyLevel;
}

export interface RecordApprovalResult {
  newScore:          number;
  newLevel:          AutonomyLevel;
  newStreak:         number;
  proposalCreated:   boolean;
  autoActivated:     boolean;
}

// ── recordApproval ────────────────────────────────────────────────────────────

/**
 * Process a task approval rating.
 *
 * 1. Compute new trust score from rolling metrics.
 * 2. Update streak (reset on < 4★, increment on ≥ 4★).
 * 3. If streak reaches STREAK_THRESHOLD:
 *    - Tier A → create trust_proposal (human must approve)
 *    - Tier B → auto-activate next level immediately
 * 4. Upsert trust_scores row.
 */
export async function recordApproval(
  db: Db,
  params: RecordApprovalParams,
): Promise<RecordApprovalResult> {
  const {
    companyId, agentId, skillType, skillAutonomyTier,
    rating, qualityRatingAvg, gatePassRate, schemaPassRate,
    taskCountWindow, currentStreak, currentLevel,
  } = params;

  // 1. Compute new score
  const newScore = calculateTrustScore({
    qualityRatingAvg,
    gatePassRate,
    schemaPassRate,
  });
  const scoreLevel = getAutonomyLevel(newScore);

  // 2. Update streak
  const newStreak = rating >= 4 ? currentStreak + 1 : 0;
  const triggerProposal = newStreak >= STREAK_THRESHOLD;

  // 3. Determine new level and whether to create proposal / auto-activate
  let newLevel:        AutonomyLevel = scoreLevel;
  let proposalCreated  = false;
  let autoActivated    = false;

  if (triggerProposal) {
    const target = nextLevel(currentLevel);

    if (target !== null) {
      if (skillAutonomyTier === "A") {
        // RULE: Tier A — NEVER auto-activate. Always create proposal for human.
        await db.insert(trustProposals).values({
          companyId,
          agentId,
          skillType,
          currentLevel,
          proposedLevel: target,
          trustScore:    String(newScore),
          approvalStreak: newStreak,
          evidence: {
            taskCount:     taskCountWindow,
            avgRating:     qualityRatingAvg,
            gatePassRate,
            schemaPassRate,
          },
          status: "pending",
        });
        proposalCreated = true;
        newLevel = currentLevel; // level unchanged until human approves

      } else {
        // Tier B — auto-activate the upgrade
        newLevel       = target;
        autoActivated  = true;
        logger.info(
          { agentId, skillType, from: currentLevel, to: target },
          "trust: Tier B auto-activation",
        );
      }
    }
  }

  // 4. Upsert trust_scores
  // Drizzle doesn't have a clean upsert for all adapters; use insert + onConflict
  await (db as any).insert(trustScores).values({
    companyId,
    agentId,
    skillType,
    score:            String(newScore),
    autonomyLevel:    newLevel,
    approvalStreak:   newStreak,
    qualityRatingAvg: String(qualityRatingAvg),
    gatePassRate:     String(gatePassRate),
    schemaPassRate:   String(schemaPassRate),
    taskCountWindow,
  }).onConflictDoUpdate({
    target: [trustScores.agentId, trustScores.skillType],
    set: {
      score:            String(newScore),
      autonomyLevel:    newLevel,
      approvalStreak:   newStreak,
      qualityRatingAvg: String(qualityRatingAvg),
      gatePassRate:     String(gatePassRate),
      schemaPassRate:   String(schemaPassRate),
      taskCountWindow,
    },
  });

  return { newScore, newLevel, newStreak, proposalCreated, autoActivated };
}

// ── checkTrustDowngrade ───────────────────────────────────────────────────────

export interface CheckDowngradeParams {
  companyId:     string;
  agentId:       string;
  skillType:     string;
  currentLevel:  AutonomyLevel;
  newScore:      number;
}

export interface CheckDowngradeResult {
  downgraded: boolean;
  newLevel:   AutonomyLevel;
}

/**
 * Check if a new trust score warrants a downgrade.
 * Called after gate violations or damage-control events.
 *
 * If downgraded, updates the trust_scores row and fires a notification stub.
 */
export async function checkTrustDowngrade(
  db: Db,
  params: CheckDowngradeParams,
): Promise<CheckDowngradeResult> {
  const { companyId, agentId, skillType, currentLevel, newScore } = params;
  const newLevel = getAutonomyLevel(newScore);

  if (!isDowngrade(currentLevel, newLevel)) {
    return { downgraded: false, newLevel: currentLevel };
  }

  // Persist the downgrade
  await db
    .update(trustScores)
    .set({ autonomyLevel: newLevel, approvalStreak: 0 })
    .where(
      and(
        eq(trustScores.agentId, agentId),
        eq(trustScores.skillType, skillType),
      ),
    );

  // Notify operator — full implementation in M15 (SSE) / M13 (console)
  await notifyDowngradeStub({ companyId, agentId, skillType, from: currentLevel, to: newLevel });

  logger.warn(
    { agentId, skillType, from: currentLevel, to: newLevel, newScore },
    "trust: autonomy downgraded",
  );

  return { downgraded: true, newLevel };
}

// ── Stub ──────────────────────────────────────────────────────────────────────

async function notifyDowngradeStub(params: {
  companyId: string;
  agentId:   string;
  skillType: string;
  from:      AutonomyLevel;
  to:        AutonomyLevel;
}): Promise<void> {
  void params;
  // M15: emit.trustDowngraded({ companyId, agentId, skillType, from, to })
}
