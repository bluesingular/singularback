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
import type { Db } from "@paperclipai/db";
export type CardType = "anomaly" | "trust" | "relationship" | "goal";
export interface CandidateCard {
    cardType: CardType;
    title: string;
    body: string;
    urgency: 1 | 2 | 3 | 4 | 5;
    insightKey: string;
    actionUrl?: string;
}
export type CardGenerator = (db: Db, companyId: string) => Promise<CandidateCard[]>;
/**
 * Run the morning intelligence sweep for one company.
 *
 * @param generators  Array of card generators (anomaly, trust, relationship, goal).
 *                    Injected so tests can supply mocks without BullMQ.
 * @returns           Number of cards inserted (always ≤ MAX_CARDS_PER_DAY).
 */
export declare function generateIntelligenceCards(db: Db, companyId: string, generators: CardGenerator[]): Promise<number>;
/**
 * Trust anomaly generator: surfaces agents whose trust score dropped recently.
 * Real implementation queries trust_scores; stub returns empty for now.
 */
export declare const trustAnomalyGenerator: CardGenerator;
/**
 * Goal progress generator: surfaces goals that are behind schedule.
 * Real implementation queries goals table; stub returns empty for now.
 */
export declare const goalProgressGenerator: CardGenerator;
//# sourceMappingURL=sweep.d.ts.map