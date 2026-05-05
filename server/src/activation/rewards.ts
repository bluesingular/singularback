/**
 * server/src/activation/rewards.ts
 *
 * Approval micro-rewards — M11.
 *
 * After each task approval, a small encouraging message is injected inline
 * into the task thread. The message varies by:
 *   - Current approval streak (milestone messages at multiples of 10)
 *   - Rating quality (5★ = enthusiastic, 4★ = positive, 3★ = neutral)
 *   - Company locale (fr | en)
 *
 * Messages are sourced from EMOTIONAL_LAYER.md §7.
 */

export interface MicroRewardContext {
  /** Star rating just submitted: 1–5 */
  rating:          number;
  /** Consecutive 4+★ approvals (after counting the current one) */
  approvalStreak:  number;
  /** Agent display name */
  agentName:       string;
  /** Company locale — defaults to 'fr' */
  locale?:         string;
}

export interface MicroReward {
  message:     string;
  isMilestone: boolean;
}

const STREAK_MILESTONE = 10;

// ── French message banks (EMOTIONAL_LAYER.md §7) ──────────────────────────────

const FR_5_STAR = [
  (name: string) => `Excellent travail de ${name} ! Continuez sur cette lancée.`,
  (name: string) => `${name} excelle. Votre équipe IA fonctionne parfaitement.`,
  (name: string) => `Résultat parfait de ${name}. C'est exactement ce qu'on attend.`,
];

const FR_4_STAR = [
  (name: string) => `Bon travail de ${name}. Chaque approbation renforce sa confiance.`,
  (name: string) => `${name} progresse bien. Merci pour votre retour.`,
  (name: string) => `${name} a bien géré ça. Votre validation compte.`,
];

const FR_3_STAR = [
  (name: string) => `Retour noté pour ${name}. Elle va s'améliorer.`,
  (name: string) => `${name} prend note de votre évaluation.`,
];

const FR_MILESTONE = [
  (name: string, streak: number) =>
    `🎯 ${streak} approbations consécutives pour ${name} ! Elle mérite peut-être plus d'autonomie.`,
  (name: string, streak: number) =>
    `🏆 Incroyable — ${streak} validations d'affilée pour ${name}. Voulez-vous lui faire davantage confiance ?`,
];

// ── English message banks ─────────────────────────────────────────────────────

const EN_5_STAR = [
  (name: string) => `Excellent work from ${name}! Keep it up.`,
  (name: string) => `${name} is excelling. Your AI team is running perfectly.`,
  (name: string) => `Perfect result from ${name}. Exactly what we expect.`,
];

const EN_4_STAR = [
  (name: string) => `Good work from ${name}. Every approval builds their confidence.`,
  (name: string) => `${name} is progressing well. Thanks for your feedback.`,
  (name: string) => `${name} handled that well. Your validation matters.`,
];

const EN_3_STAR = [
  (name: string) => `Feedback noted for ${name}. They will improve.`,
  (name: string) => `${name} has taken note of your rating.`,
];

const EN_MILESTONE = [
  (name: string, streak: number) =>
    `🎯 ${streak} consecutive approvals for ${name}! They may deserve more autonomy.`,
  (name: string, streak: number) =>
    `🏆 Incredible — ${streak} approvals in a row for ${name}. Ready to trust them more?`,
];

// ── Locale resolution ─────────────────────────────────────────────────────────

interface MessageBank {
  fiveStar:  ((name: string) => string)[];
  fourStar:  ((name: string) => string)[];
  threeStar: ((name: string) => string)[];
  milestone: ((name: string, streak: number) => string)[];
}

function getBankForLocale(locale: string): MessageBank {
  if (locale.startsWith("en")) {
    return { fiveStar: EN_5_STAR, fourStar: EN_4_STAR, threeStar: EN_3_STAR, milestone: EN_MILESTONE };
  }
  return { fiveStar: FR_5_STAR, fourStar: FR_4_STAR, threeStar: FR_3_STAR, milestone: FR_MILESTONE };
}

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
  const { rating, approvalStreak, agentName, locale = "fr" } = ctx;
  const bank = getBankForLocale(locale);
  const seed = approvalStreak;

  const isMilestone =
    approvalStreak > 0 &&
    approvalStreak % STREAK_MILESTONE === 0 &&
    rating >= 4;

  if (isMilestone) {
    return {
      message:     pick(bank.milestone, seed)(agentName, approvalStreak),
      isMilestone: true,
    };
  }

  if (rating === 5) {
    return { message: pick(bank.fiveStar, seed)(agentName), isMilestone: false };
  }

  if (rating >= 4) {
    return { message: pick(bank.fourStar, seed)(agentName), isMilestone: false };
  }

  return { message: pick(bank.threeStar, seed)(agentName), isMilestone: false };
}
