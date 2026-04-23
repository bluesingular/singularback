/**
 * server/src/intelligence/cooldown.ts
 *
 * 14-day cooldown enforcement for intelligence cards.
 *
 * An insightKey is "on cooldown" if a card with that key was created for the
 * same company within the last COOLDOWN_DAYS days. This prevents the same
 * insight from being surfaced repeatedly and spamming the operator.
 *
 * insightKey format: "{cardType}:{entityId}"
 *   e.g. "trust:agent-uuid:qualification-cv"
 *        "relationship:contact-uuid"
 *        "goal:goal-uuid"
 *        "anomaly:agent-uuid:metric"
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { intelligenceCards } from "@paperclipai/db";
export const COOLDOWN_DAYS = 14;
export const MAX_CARDS_PER_DAY = 3;
export const CARD_EXPIRY_DAYS = 7;
/**
 * Returns true if the insightKey is on cooldown for this company
 * (i.e. a card with that key was already created within COOLDOWN_DAYS).
 */
export async function isOnCooldown(db, companyId, insightKey) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - COOLDOWN_DAYS);
    const [row] = await db
        .select({ count: sql `count(*)::int` })
        .from(intelligenceCards)
        .where(and(eq(intelligenceCards.companyId, companyId), eq(intelligenceCards.insightKey, insightKey), gte(intelligenceCards.createdAt, cutoff)));
    return (row?.count ?? 0) > 0;
}
/**
 * Build the expiry timestamp for a new card (now + CARD_EXPIRY_DAYS).
 */
export function cardExpiresAt() {
    const d = new Date();
    d.setDate(d.getDate() + CARD_EXPIRY_DAYS);
    return d;
}
//# sourceMappingURL=cooldown.js.map