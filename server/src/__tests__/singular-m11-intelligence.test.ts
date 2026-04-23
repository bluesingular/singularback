/**
 * M11 — Morning intelligence + activation sequence
 *
 * Tests:
 *  1.  generateIntelligenceCards: inserts at most MAX_CARDS_PER_DAY (3)
 *  2.  generateIntelligenceCards: cards ranked by urgency descending
 *  3.  generateIntelligenceCards: skips candidates on 14-day cooldown
 *  4.  generateIntelligenceCards: all candidates on cooldown → 0 cards inserted
 *  5.  generateIntelligenceCards: exactly 3 candidates, none on cooldown → 3 inserted
 *  6.  isOnCooldown: returns true when insight seen within 14 days
 *  7.  isOnCooldown: returns false when no recent record
 *  8.  checkActivationTrigger: day_0_seed fires when seedTaskScheduled=true
 *  9.  checkActivationTrigger: day_2_first_task fires when days≥2 + tasks≥1
 * 10.  checkActivationTrigger: day_2_first_task does NOT fire when days<2
 * 11.  checkActivationTrigger: day_7_summary fires when days≥7
 * 12.  pendingTriggers: excludes already-fired triggers
 * 13.  buildMicroRewardMessage: streak=1, rating=5 → enthusiastic message (French)
 * 14.  buildMicroRewardMessage: streak=10, rating=4 → milestone message with streak count
 * 15.  buildMicroRewardMessage: rating=3 → neutral message
 * 16.  buildMicroRewardMessage: milestone isMilestone=true; others isMilestone=false
 * 17.  MAX_CARDS_PER_DAY is 3; COOLDOWN_DAYS is 14
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  generateIntelligenceCards,
  type CandidateCard,
  type CardGenerator,
} from "../intelligence/sweep.js";

import {
  isOnCooldown,
  MAX_CARDS_PER_DAY,
  COOLDOWN_DAYS,
  CARD_EXPIRY_DAYS,
} from "../intelligence/cooldown.js";

import {
  checkActivationTrigger,
  pendingTriggers,
  STANDARD_TRIGGERS,
  type ActivationState,
} from "../activation/sequence.js";

import { buildMicroRewardMessage } from "../activation/rewards.js";

// ── DB helpers ────────────────────────────────────────────────────────────────

/**
 * DB mock for generateIntelligenceCards.
 * cooldownMap: insightKey → count (0 = not on cooldown, >0 = on cooldown)
 */
function makeSweepDb(cooldownMap: Record<string, number> = {}) {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  // select().from().where() → [{ count }]
  const where = vi.fn().mockImplementation((..._args: unknown[]) => {
    // We can't easily inspect which insightKey is being queried here,
    // so we use a call-count approach keyed by insertion order.
    // Instead, return a thennable that resolves based on the last queried key.
    return Promise.resolve([{ count: 0 }]); // default: not on cooldown
  });

  // Build a more targeted mock using a counter approach
  let cooldownCallIndex = 0;
  const cooldownKeys = Object.keys(cooldownMap);

  const whereForCooldown = vi.fn().mockImplementation(() => {
    // isOnCooldown queries once per candidate card
    const key = cooldownKeys[cooldownCallIndex] ?? "";
    const count = cooldownMap[key] ?? 0;
    cooldownCallIndex++;
    return Promise.resolve([{ count }]);
  });

  const from = vi.fn().mockReturnValue({ where: whereForCooldown });
  const select = vi.fn().mockReturnValue({ from });

  return {
    db: { select, insert } as any,
    insertValues,
    insert,
  };
}

/** Helper: make a card generator that always returns the given candidates */
function makeGenerator(cards: CandidateCard[]): CardGenerator {
  return vi.fn().mockResolvedValue(cards);
}

function card(
  insightKey: string,
  urgency: 1 | 2 | 3 | 4 | 5,
  cardType: CandidateCard["cardType"] = "trust",
): CandidateCard {
  return {
    cardType,
    title:      `Card ${insightKey}`,
    body:       `Body for ${insightKey}`,
    urgency,
    insightKey,
  };
}

// ── generateIntelligenceCards ─────────────────────────────────────────────────

describe("generateIntelligenceCards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("1. inserts at most MAX_CARDS_PER_DAY (3) even with 5 candidates", async () => {
    const { db, insertValues } = makeSweepDb(); // all not on cooldown
    const gen = makeGenerator([
      card("t1", 5), card("t2", 4), card("t3", 3),
      card("t4", 2), card("t5", 1),
    ]);

    const count = await generateIntelligenceCards(db, "company-1", [gen]);

    expect(count).toBe(3);
    expect(insertValues).toHaveBeenCalledTimes(3);
  });

  it("2. cards inserted in urgency-descending order (5 first)", async () => {
    const { db, insertValues } = makeSweepDb();
    const gen = makeGenerator([
      card("low",  1),
      card("high", 5),
      card("mid",  3),
    ]);

    await generateIntelligenceCards(db, "company-1", [gen]);

    const firstCall  = insertValues.mock.calls[0][0];
    const secondCall = insertValues.mock.calls[1][0];
    const thirdCall  = insertValues.mock.calls[2][0];

    expect(firstCall.urgency).toBe(5);
    expect(secondCall.urgency).toBe(3);
    expect(thirdCall.urgency).toBe(1);
  });

  it("3. skips candidates that are on 14-day cooldown", async () => {
    // "cooled" is on cooldown (count=1), "fresh" is not (count=0)
    const { db, insertValues } = makeSweepDb({
      cooled: 1, // on cooldown
      fresh:  0, // available
    });
    const gen = makeGenerator([card("cooled", 5), card("fresh", 3)]);

    const count = await generateIntelligenceCards(db, "company-1", [gen]);

    expect(count).toBe(1);
    const inserted = insertValues.mock.calls[0][0];
    expect(inserted.insightKey).toBe("fresh");
  });

  it("4. all candidates on cooldown → 0 cards inserted", async () => {
    const { db, insertValues } = makeSweepDb({ a: 1, b: 1, c: 1 });
    const gen = makeGenerator([card("a", 5), card("b", 4), card("c", 3)]);

    const count = await generateIntelligenceCards(db, "company-1", [gen]);

    expect(count).toBe(0);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("5. exactly 3 candidates, none on cooldown → 3 inserted", async () => {
    const { db, insertValues } = makeSweepDb({ x: 0, y: 0, z: 0 });
    const gen = makeGenerator([card("x", 5), card("y", 4), card("z", 2)]);

    const count = await generateIntelligenceCards(db, "company-1", [gen]);

    expect(count).toBe(3);
    expect(insertValues).toHaveBeenCalledTimes(3);
  });
});

// ── isOnCooldown ──────────────────────────────────────────────────────────────

describe("isOnCooldown", () => {
  it("6. returns true when insight seen within 14 days (count > 0)", async () => {
    const where = vi.fn().mockResolvedValue([{ count: 1 }]);
    const from  = vi.fn().mockReturnValue({ where });
    const db = { select: vi.fn().mockReturnValue({ from }) } as any;

    const result = await isOnCooldown(db, "company-1", "trust:agent-1:cv");
    expect(result).toBe(true);
  });

  it("7. returns false when no recent record (count = 0)", async () => {
    const where = vi.fn().mockResolvedValue([{ count: 0 }]);
    const from  = vi.fn().mockReturnValue({ where });
    const db = { select: vi.fn().mockReturnValue({ from }) } as any;

    const result = await isOnCooldown(db, "company-1", "trust:agent-1:cv");
    expect(result).toBe(false);
  });
});

// ── checkActivationTrigger ────────────────────────────────────────────────────

describe("checkActivationTrigger", () => {
  const day0   = STANDARD_TRIGGERS.find((t) => t.key === "day_0_seed")!;
  const day2   = STANDARD_TRIGGERS.find((t) => t.key === "day_2_first_task")!;
  const day7   = STANDARD_TRIGGERS.find((t) => t.key === "day_7_summary")!;

  const baseState: ActivationState = {
    daysSinceInstall:  0,
    tasksCompleted:    0,
    seedTaskScheduled: false,
    contactsEngaged:   0,
  };

  it("8. day_0_seed fires when seedTaskScheduled=true", () => {
    expect(checkActivationTrigger(day0, { ...baseState, seedTaskScheduled: true })).toBe(true);
    expect(checkActivationTrigger(day0, { ...baseState, seedTaskScheduled: false })).toBe(false);
  });

  it("9. day_2_first_task fires when days≥2 AND tasks≥1", () => {
    expect(
      checkActivationTrigger(day2, { ...baseState, daysSinceInstall: 2, tasksCompleted: 1 }),
    ).toBe(true);
  });

  it("10. day_2_first_task does NOT fire when days<2 even if task completed", () => {
    expect(
      checkActivationTrigger(day2, { ...baseState, daysSinceInstall: 1, tasksCompleted: 5 }),
    ).toBe(false);
  });

  it("11. day_7_summary fires when days≥7", () => {
    expect(
      checkActivationTrigger(day7, { ...baseState, daysSinceInstall: 7 }),
    ).toBe(true);
    expect(
      checkActivationTrigger(day7, { ...baseState, daysSinceInstall: 6 }),
    ).toBe(false);
  });
});

// ── pendingTriggers ───────────────────────────────────────────────────────────

describe("pendingTriggers", () => {
  it("12. excludes already-fired triggers from results", () => {
    const state: ActivationState = {
      daysSinceInstall:  7,
      tasksCompleted:    10,
      seedTaskScheduled: true,
      contactsEngaged:   2,
    };

    // All 5 triggers should fire for this state
    const all = pendingTriggers(STANDARD_TRIGGERS, state, new Set());
    expect(all.length).toBe(5);

    // With day_0_seed and day_7_summary already fired, only 3 remain
    const remaining = pendingTriggers(
      STANDARD_TRIGGERS,
      state,
      new Set(["day_0_seed", "day_7_summary"]),
    );
    expect(remaining.length).toBe(3);
    expect(remaining.map((t) => t.key)).not.toContain("day_0_seed");
    expect(remaining.map((t) => t.key)).not.toContain("day_7_summary");
  });
});

// ── buildMicroRewardMessage ───────────────────────────────────────────────────

describe("buildMicroRewardMessage", () => {
  it("13. streak=1, rating=5 → enthusiastic French message", () => {
    const reward = buildMicroRewardMessage({
      rating:         5,
      approvalStreak: 1,
      agentName:      "Sophie",
    });
    expect(reward.isMilestone).toBe(false);
    expect(reward.message).toContain("Sophie");
    // Message should be in French (contains French words)
    expect(reward.message).toMatch(/[éèêàùûî]|travail|Excellent|excelle|parfait/i);
  });

  it("14. streak=10, rating=4 → milestone message containing streak count", () => {
    const reward = buildMicroRewardMessage({
      rating:         4,
      approvalStreak: 10,
      agentName:      "Sophie",
    });
    expect(reward.isMilestone).toBe(true);
    expect(reward.message).toContain("10");
    expect(reward.message).toContain("Sophie");
  });

  it("15. rating=3 → neutral message", () => {
    const reward = buildMicroRewardMessage({
      rating:         3,
      approvalStreak: 0,
      agentName:      "Marc",
    });
    expect(reward.isMilestone).toBe(false);
    expect(reward.message).toContain("Marc");
  });

  it("16. milestone isMilestone=true; non-milestone isMilestone=false", () => {
    const milestone = buildMicroRewardMessage({ rating: 4, approvalStreak: 20, agentName: "A" });
    const normal    = buildMicroRewardMessage({ rating: 4, approvalStreak: 7,  agentName: "A" });
    expect(milestone.isMilestone).toBe(true);
    expect(normal.isMilestone).toBe(false);
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("17. MAX_CARDS_PER_DAY=3, COOLDOWN_DAYS=14, CARD_EXPIRY_DAYS=7", () => {
    expect(MAX_CARDS_PER_DAY).toBe(3);
    expect(COOLDOWN_DAYS).toBe(14);
    expect(CARD_EXPIRY_DAYS).toBe(7);
  });

  it("STANDARD_TRIGGERS has exactly 5 entries", () => {
    expect(STANDARD_TRIGGERS).toHaveLength(5);
    const keys = STANDARD_TRIGGERS.map((t) => t.key);
    expect(keys).toContain("day_0_seed");
    expect(keys).toContain("day_2_first_task");
    expect(keys).toContain("day_4_milestone");
    expect(keys).toContain("day_6_relationship");
    expect(keys).toContain("day_7_summary");
  });
});
