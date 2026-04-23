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
import type { Db } from "@paperclipai/db";
export declare const COOLDOWN_DAYS = 14;
export declare const MAX_CARDS_PER_DAY = 3;
export declare const CARD_EXPIRY_DAYS = 7;
/**
 * Returns true if the insightKey is on cooldown for this company
 * (i.e. a card with that key was already created within COOLDOWN_DAYS).
 */
export declare function isOnCooldown(db: Db, companyId: string, insightKey: string): Promise<boolean>;
/**
 * Build the expiry timestamp for a new card (now + CARD_EXPIRY_DAYS).
 */
export declare function cardExpiresAt(): Date;
//# sourceMappingURL=cooldown.d.ts.map