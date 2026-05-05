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
const STREAK_MILESTONE = 10;
// ── French message banks (EMOTIONAL_LAYER.md §7) ──────────────────────────────
const FR_5_STAR = [
    (name) => `Excellent travail de ${name} ! Continuez sur cette lancée.`,
    (name) => `${name} excelle. Votre équipe IA fonctionne parfaitement.`,
    (name) => `Résultat parfait de ${name}. C'est exactement ce qu'on attend.`,
];
const FR_4_STAR = [
    (name) => `Bon travail de ${name}. Chaque approbation renforce sa confiance.`,
    (name) => `${name} progresse bien. Merci pour votre retour.`,
    (name) => `${name} a bien géré ça. Votre validation compte.`,
];
const FR_3_STAR = [
    (name) => `Retour noté pour ${name}. Elle va s'améliorer.`,
    (name) => `${name} prend note de votre évaluation.`,
];
const FR_MILESTONE = [
    (name, streak) => `🎯 ${streak} approbations consécutives pour ${name} ! Elle mérite peut-être plus d'autonomie.`,
    (name, streak) => `🏆 Incroyable — ${streak} validations d'affilée pour ${name}. Voulez-vous lui faire davantage confiance ?`,
];
// ── English message banks ─────────────────────────────────────────────────────
const EN_5_STAR = [
    (name) => `Excellent work from ${name}! Keep it up.`,
    (name) => `${name} is excelling. Your AI team is running perfectly.`,
    (name) => `Perfect result from ${name}. Exactly what we expect.`,
];
const EN_4_STAR = [
    (name) => `Good work from ${name}. Every approval builds their confidence.`,
    (name) => `${name} is progressing well. Thanks for your feedback.`,
    (name) => `${name} handled that well. Your validation matters.`,
];
const EN_3_STAR = [
    (name) => `Feedback noted for ${name}. They will improve.`,
    (name) => `${name} has taken note of your rating.`,
];
const EN_MILESTONE = [
    (name, streak) => `🎯 ${streak} consecutive approvals for ${name}! They may deserve more autonomy.`,
    (name, streak) => `🏆 Incredible — ${streak} approvals in a row for ${name}. Ready to trust them more?`,
];
function getBankForLocale(locale) {
    if (locale.startsWith("en")) {
        return { fiveStar: EN_5_STAR, fourStar: EN_4_STAR, threeStar: EN_3_STAR, milestone: EN_MILESTONE };
    }
    return { fiveStar: FR_5_STAR, fourStar: FR_4_STAR, threeStar: FR_3_STAR, milestone: FR_MILESTONE };
}
// ── Selector ──────────────────────────────────────────────────────────────────
function pick(arr, seed) {
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
export function buildMicroRewardMessage(ctx) {
    const { rating, approvalStreak, agentName, locale = "fr" } = ctx;
    const bank = getBankForLocale(locale);
    const seed = approvalStreak;
    const isMilestone = approvalStreak > 0 &&
        approvalStreak % STREAK_MILESTONE === 0 &&
        rating >= 4;
    if (isMilestone) {
        return {
            message: pick(bank.milestone, seed)(agentName, approvalStreak),
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
//# sourceMappingURL=rewards.js.map