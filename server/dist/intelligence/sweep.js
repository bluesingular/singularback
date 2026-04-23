/**
 * server/src/intelligence/sweep.ts
 *
 * Morning intelligence sweep — runs at 8am via BullMQ cron (scheduled in M12).
 *
 * For each company:
 *   1. Collect candidate cards from 4 sources (anomaly, trust, relationship, goal).
 *   2. Filter candidates on 14-day cooldown.
 *   3. Rank remaining candidates by urgency (5 = highest).
 *   4. Take the top MAX_CARDS_PER_DAY (3).
 *   5. Insert them into intelligence_cards.
 *
 * INVARIANT: No more than 3 cards are ever inserted per company per sweep run.
 */
import { intelligenceCards } from "@paperclipai/db";
import { isOnCooldown, cardExpiresAt, MAX_CARDS_PER_DAY } from "./cooldown.js";
import pino from "pino";
const logger = pino({ name: "intelligence-sweep" });
// ── Main sweep ────────────────────────────────────────────────────────────────
/**
 * Run the morning intelligence sweep for one company.
 *
 * @param generators  Array of card generators (anomaly, trust, relationship, goal).
 *                    Injected so tests can supply mocks without BullMQ.
 * @returns           Number of cards inserted (always ≤ MAX_CARDS_PER_DAY).
 */
export async function generateIntelligenceCards(db, companyId, generators) {
    // 1. Collect candidates from all generators
    const candidatesNested = await Promise.all(generators.map((gen) => gen(db, companyId)));
    const candidates = candidatesNested.flat();
    // 2. Filter out candidates on 14-day cooldown
    const eligible = [];
    for (const card of candidates) {
        const cooled = await isOnCooldown(db, companyId, card.insightKey);
        if (!cooled)
            eligible.push(card);
    }
    // 3. Rank by urgency descending, take top 3
    const top = eligible
        .sort((a, b) => b.urgency - a.urgency)
        .slice(0, MAX_CARDS_PER_DAY);
    if (top.length === 0) {
        logger.info({ companyId }, "intelligence-sweep: no eligible cards");
        return 0;
    }
    // 4. Insert — one by one to keep audit ordering predictable
    const expiresAt = cardExpiresAt();
    for (const card of top) {
        await db.insert(intelligenceCards).values({
            companyId,
            cardType: card.cardType,
            title: card.title,
            body: card.body,
            urgency: card.urgency,
            actionUrl: card.actionUrl ?? null,
            insightKey: card.insightKey,
            expiresAt,
        });
    }
    logger.info({ companyId, inserted: top.length }, "intelligence-sweep: cards inserted");
    return top.length;
}
// ── Built-in generators (stubs — real data queries added per module) ──────────
/**
 * Trust anomaly generator: surfaces agents whose trust score dropped recently.
 * Real implementation queries trust_scores; stub returns empty for now.
 */
export const trustAnomalyGenerator = async (_db, _companyId) => {
    // M11 stub — real implementation queries trust_scores for drops > 0.5 in 7 days
    return [];
};
/**
 * Goal progress generator: surfaces goals that are behind schedule.
 * Real implementation queries goals table; stub returns empty for now.
 */
export const goalProgressGenerator = async (_db, _companyId) => {
    // M11 stub — real implementation queries goals table
    return [];
};
//# sourceMappingURL=sweep.js.map