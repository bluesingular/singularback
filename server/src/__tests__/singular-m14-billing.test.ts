/**
 * M14 — Stripe billing
 *
 * Tests:
 *  1.  handleStripeWebhook: new event → processed=true, recorded in stripe_events
 *  2.  handleStripeWebhook: duplicate event → processed=false, no DB side effects
 *  3.  handleStripeWebhook: subscription.updated → company plan + limits updated
 *  4.  handleStripeWebhook: subscription.deleted → company downgraded to "solo"
 *  5.  handleStripeWebhook: subscription.updated with lookup_key → plan parsed from key
 *  6.  handleStripeWebhook: unhandled event type → recorded, no company update
 *  7.  handleStripeWebhook: duplicate webhook → company update NOT called twice
 *  8.  applyPlanLimits: "solo" → tasksLimit=500, tokensLimit=5_000_000
 *  9.  applyPlanLimits: "growth" → tasksLimit=2_000, tokensLimit=20_000_000
 *  10. applyPlanLimits: "pro" → tasksLimit=6_000, tokensLimit=60_000_000
 *  11. applyPlanLimits: "enterprise" → tasksLimit=99_999, tokensLimit=999_000_000
 *  12. applyPlanLimits: unknown plan → throws UnknownPlanError
 *  13. PLAN_LIMITS: has exactly 4 plans (solo, growth, pro, enterprise)
 *  14. handleStripeWebhook: subscription.updated with metadata.plan → uses metadata
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  handleStripeWebhook,
  type StripeEventPayload,
} from "../billing/webhook.js";

import {
  applyPlanLimits,
  PLAN_LIMITS,
  UnknownPlanError,
} from "../billing/plans.js";

// ── DB mock builder ───────────────────────────────────────────────────────────

function makeBillingDb(opts: {
  /** Whether the stripe_events select finds an existing row (duplicate check) */
  eventExists?: boolean;
} = {}) {
  const { eventExists = false } = opts;

  // insert mock (for stripeEvents)
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insert       = vi.fn().mockReturnValue({ values: insertValues });

  // update mock (for companies)
  const updateWhere  = vi.fn().mockResolvedValue([]);
  const updateSet    = vi.fn().mockReturnValue({ where: updateWhere });
  const update       = vi.fn().mockReturnValue({ set: updateSet });

  // select mock — returns existing event if eventExists=true, else empty
  const selectWhere  = vi.fn().mockResolvedValue(eventExists ? [{ id: "existing-id" }] : []);
  const selectFrom   = vi.fn().mockReturnValue({ where: selectWhere });
  const select       = vi.fn().mockReturnValue({ from: selectFrom });

  // transaction mock — runs callback with tx that has insert + update
  const tx = { insert, update } as any;
  const transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb(tx),
  );

  const db = { select, transaction } as any;

  return { db, select, selectWhere, insert, insertValues, update, updateSet, updateWhere, transaction };
}

// ── Stripe event fixture ──────────────────────────────────────────────────────

function makeEvent(overrides: Partial<StripeEventPayload> = {}): StripeEventPayload {
  return {
    id:   "evt_test_001",
    type: "customer.subscription.updated",
    data: {
      object: {
        id:       "sub_test_001",
        customer: "cus_test_001",
        status:   "active",
        items: {
          data: [{ price: { lookup_key: "singular_growth_monthly" } }],
        },
        metadata: {},
      },
    },
    ...overrides,
  };
}

// ── handleStripeWebhook ───────────────────────────────────────────────────────

describe("handleStripeWebhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("1. new event → processed=true, event recorded in stripe_events", async () => {
    const { db, insertValues } = makeBillingDb({ eventExists: false });

    const result = await handleStripeWebhook(db, makeEvent());

    expect(result.processed).toBe(true);
    expect(result.stripeEventId).toBe("evt_test_001");
    expect(insertValues).toHaveBeenCalledOnce();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ stripeEventId: "evt_test_001" }),
    );
  });

  it("2. duplicate event → processed=false, no transaction started", async () => {
    const { db, transaction } = makeBillingDb({ eventExists: true });

    const result = await handleStripeWebhook(db, makeEvent());

    expect(result.processed).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("3. subscription.updated → company plan + limits updated", async () => {
    const { db, updateSet, updateWhere } = makeBillingDb({ eventExists: false });

    await handleStripeWebhook(db, makeEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id:       "sub_001",
          customer: "cus_001",
          items:    { data: [{ price: { lookup_key: "singular_pro_monthly" } }] },
          metadata: {},
        },
      },
    }));

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "pro", tasksLimitMonth: 6_000, tokensLimitMonth: 60_000_000 }),
    );
    expect(updateWhere).toHaveBeenCalled();
  });

  it("4. subscription.deleted → company downgraded to 'solo'", async () => {
    const { db, updateSet } = makeBillingDb({ eventExists: false });

    await handleStripeWebhook(db, makeEvent({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_001", customer: "cus_001", metadata: {} } },
    }));

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "solo", tasksLimitMonth: 500 }),
    );
  });

  it("5. subscription.updated with lookup_key → plan parsed from price key", async () => {
    const { db, updateSet } = makeBillingDb({ eventExists: false });

    await handleStripeWebhook(db, makeEvent({
      data: {
        object: {
          id:       "sub_001",
          customer: "cus_001",
          items:    { data: [{ price: { lookup_key: "singular_enterprise_yearly" } }] },
          metadata: {},
        },
      },
    }));

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "enterprise", tasksLimitMonth: 99_999 }),
    );
  });

  it("6. unhandled event type → recorded, no company update", async () => {
    const { db, insertValues, update } = makeBillingDb({ eventExists: false });

    const result = await handleStripeWebhook(db, makeEvent({ type: "payment_intent.succeeded" }));

    expect(result.processed).toBe(true);
    expect(insertValues).toHaveBeenCalledOnce(); // event recorded
    expect(update).not.toHaveBeenCalled();       // no company update
  });

  it("7. duplicate webhook → company update NOT called twice (second call is no-op)", async () => {
    // First call processes normally
    const { db: db1, updateSet: updateSet1 } = makeBillingDb({ eventExists: false });
    await handleStripeWebhook(db1, makeEvent());
    expect(updateSet1).toHaveBeenCalledOnce();

    // Second call with same eventId → eventExists=true → skipped
    const { db: db2, updateSet: updateSet2 } = makeBillingDb({ eventExists: true });
    const result2 = await handleStripeWebhook(db2, makeEvent());
    expect(result2.processed).toBe(false);
    expect(updateSet2).not.toHaveBeenCalled();
  });

  it("14. subscription.updated with metadata.plan → uses metadata when no lookup_key", async () => {
    const { db, updateSet } = makeBillingDb({ eventExists: false });

    await handleStripeWebhook(db, makeEvent({
      data: {
        object: {
          id:       "sub_001",
          customer: "cus_001",
          items:    { data: [{ price: { lookup_key: "" } }] }, // no lookup_key
          metadata: { plan: "growth" },
        },
      },
    }));

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "growth", tasksLimitMonth: 2_000 }),
    );
  });
});

// ── applyPlanLimits ───────────────────────────────────────────────────────────

describe("applyPlanLimits", () => {
  it("8. 'solo' → tasksLimit=500, tokensLimit=5_000_000", () => {
    const limits = applyPlanLimits("solo");
    expect(limits.plan).toBe("solo");
    expect(limits.tasksLimitMonth).toBe(500);
    expect(limits.tokensLimitMonth).toBe(5_000_000);
  });

  it("9. 'growth' → tasksLimit=2_000, tokensLimit=20_000_000", () => {
    const limits = applyPlanLimits("growth");
    expect(limits.tasksLimitMonth).toBe(2_000);
    expect(limits.tokensLimitMonth).toBe(20_000_000);
  });

  it("10. 'pro' → tasksLimit=6_000, tokensLimit=60_000_000", () => {
    const limits = applyPlanLimits("pro");
    expect(limits.tasksLimitMonth).toBe(6_000);
    expect(limits.tokensLimitMonth).toBe(60_000_000);
  });

  it("11. 'enterprise' → tasksLimit=99_999, tokensLimit=999_000_000", () => {
    const limits = applyPlanLimits("enterprise");
    expect(limits.tasksLimitMonth).toBe(99_999);
    expect(limits.tokensLimitMonth).toBe(999_000_000);
  });

  it("12. unknown plan → throws UnknownPlanError", () => {
    expect(() => applyPlanLimits("starter")).toThrow(UnknownPlanError);
    expect(() => applyPlanLimits("starter")).toThrow(/starter/);
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("13. PLAN_LIMITS has exactly 4 plans", () => {
    const keys = Object.keys(PLAN_LIMITS);
    expect(keys).toHaveLength(4);
    expect(keys).toContain("solo");
    expect(keys).toContain("growth");
    expect(keys).toContain("pro");
    expect(keys).toContain("enterprise");
  });
});
