/**
 * server/src/activation/rewards.ts
 *
 * Approval micro-rewards — M11.
 *
 * After each task approval, a small encouraging message is injected inline
 * into the task thread. The message varies by:
 *   - Current approval streak (milestone messages at multiples of 10)
 *   - Rating quality (5★ = enthusiastic, 4★ = positive, 3★ = neutral)
 *
 * Messages are in French (RULE 9 — EMOTIONAL_LAYER.md section 7).
 * This file contains the message selection logic; actual delivery is via
 * the SSE layer (M15) or task thread endpoint.
 */

export interface MicroRewardContext {
  /** Star rating just submitted: 1–5 */
  rating:          number;
  /** Consecutive 4+★ approvals (after counting the current one) */
  approvalStreak:  number;
  /** Agent display name */
  agentName:       string;
}

export interface MicroReward {
  message:     string;
  isMilestone: boolean;
}

// Milestone fires at every multiple of STREAK_MILESTONE
const STREAK_MILESTONE = 10;

// ── Message banks (French — EMOTIONAL_LAYER.md §7) ────────────────────────────

const MESSAGES_5_STAR = [
  (name: string) => `Excellent travail de ${name} ! Continuez sur cette lancée.`,
  (name: string) => `${name} excelle. Votre équipe IA fonctionne parfaitement.`,
  (name: string) => `Résultat parfait de ${name}. C'est exactement ce qu'on attend.`,
];

const MESSAGES_4_STAR = [
  (name: string) => `Bon travail de ${name}. Chaque approbation renforce sa confiance.`,
  (name: string) => `${name} progresse bien. Merci pour votre retour.`,
  (name: string) => `${name} a bien géré ça. Votre validation compte.`,
];

const MESSAGES_3_STAR = [
  (name: string) => `Retour noté pour ${name}. Elle va s'améliorer.`,
  (name: string) => `${name} prend note de votre évaluation.`,
];

const MILESTONE_MESSAGES = [
  (name: string, streak: number) =>
    `🎯 ${streak} approbations consécutives pour ${name} ! Elle mérite peut-être plus d'autonomie.`,
  (name: string, streak: number) =>
    `🏆 Incroyable — ${streak} validations d'affilée pour ${name}. Voulez-vous lui faire davantage confiance ?`,
];

// ── Selector ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/**
 * Build the micro-reward message for an approval event.
 *
 * - Streak milestone (multiple of 10, rating ≥ 4) → milestone message
 * - 5★                                             → enthusiastic message
 * - 4★                                             → positive message
 * - ≤ 3★                                           → neutral message
 */
export function buildMicroRewardMessage(ctx: MicroRewardContext): MicroReward {
  const { rating, approvalStreak, agentName } = ctx;
  const seed = approvalStreak; // deterministic selection

  const isMilestone =
    approvalStreak > 0 &&
    approvalStreak % STREAK_MILESTONE === 0 &&
    rating >= 4;

  if (isMilestone) {
    return {
      message:     pick(MILESTONE_MESSAGES, seed)(agentName, approvalStreak),
      isMilestone: true,
    };
  }

  if (rating === 5) {
    return {
      message:     pick(MESSAGES_5_STAR, seed)(agentName),
      isMilestone: false,
    };
  }

  if (rating >= 4) {
    return {
      message:     pick(MESSAGES_4_STAR, seed)(agentName),
      isMilestone: false,
    };
  }

  return {
    message:     pick(MESSAGES_3_STAR, seed)(agentName),
    isMilestone: false,
  };
}
