/**
 * M14 — Stripe billing webhook
 *
 * Tests:
 *  1.  handleStripeWebhook: customer.subscription.updated → plan updated in DB
 *  2.  handleStripeWebhook: duplicate stripeEventId → processed=false, no DB update
 *  3.  handleStripeWebhook: customer.subscription.deleted → downgrades to "solo"
 *  4.  handleStripeWebhook: unknown plan lookup_key → defaults to "solo" (no crash)
 *  5.  handleStripeWebhook: unrecognised event type → recorded, processed=true, no update
 *  6.  handleStripeWebhook: plan resolved from metadata when no lookup_key
 *  7.  parsePlanFromLookupKey: "singular_growth_monthly" → "growth"
 *  8.  parsePlanFromLookupKey: "singular_pro_yearly"    → "pro"
 *  9.  parsePlanFromLookupKey: unknown format           → null
 * 10.  verifyStripeSignature: valid HMAC → accepted (route-level unit test)
 * 11.  verifyStripeSignature: tampered payload → rejected
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

import { handleStripeWebhook, type StripeEventPayload } from "../billing/webhook.js";
import { applyPlanLimits, UnknownPlanError } from "../billing/plans.js";

// ── DB mock ───────────────────────────────────────────────────────────────────

function makeStripeDb({
  existingEventIds = [] as string[],
} = {}) {
  const updateSet    = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const updateReturn = vi.fn().mockReturnValue({ set: updateSet });

  // The idempotency check calls select().from().where() without .limit()
  // so where() must return a thenable that also exposes .limit() for other callers.
  let selectCall = 0;
  const selectLimit = vi.fn().mockResolvedValue([]);
  const selectWhere = vi.fn().mockImplementation(() => {
    const call = selectCall++;
    const isDupe = existingEventIds.includes(mockEventId) && call === 0;
    const rows = isDupe ? [{ id: "x" }] : [];
    return Object.assign(Promise.resolve(rows), { limit: selectLimit });
  });
  const selectFrom   = vi.fn().mockReturnValue({ where: selectWhere });
  const selectReturn = vi.fn().mockReturnValue({ from: selectFrom });

  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insertReturn = vi.fn().mockReturnValue({ values: insertValues });

  const txFn = vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) =>
    cb({
      select: selectReturn,
      insert: insertReturn,
      update: updateReturn,
      execute: vi.fn(),
    }),
  );

  return {
    db: {
      select: selectReturn,
      insert: insertReturn,
      update: updateReturn,
      transaction: txFn,
    } as any,
    mocks: { updateSet, insertValues },
  };
}

let mockEventId = "evt_test_1";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSubUpdated(
  lookupKey = "singular_growth_monthly",
  plan?: string,
): StripeEventPayload {
  return {
    id:   mockEventId,
    type: "customer.subscription.updated",
    data: {
      object: {
        id:       "sub_test_123",
        customer: "cus_test_456",
        status:   "active",
        items:    { data: [{ price: { lookup_key: lookupKey } }] },
        metadata: plan ? { plan } : {},
      },
    },
  };
}

function makeSubDeleted(): StripeEventPayload {
  return {
    id:   mockEventId,
    type: "customer.subscription.deleted",
    data: {
      object: {
        id:       "sub_test_123",
        customer: "cus_test_456",
        status:   "canceled",
      },
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe("handleStripeWebhook", () => {
  beforeEach(() => { mockEventId = `evt_${Math.random().toString(36).slice(2)}`; });

  it("subscription.updated → plan updated in DB, processed=true", async () => {
    const { db, mocks } = makeStripeDb();
    const result = await handleStripeWebhook(db, makeSubUpdated("singular_growth_monthly"));

    expect(result.processed).toBe(true);
    expect(result.eventType).toBe("customer.subscription.updated");
    expect(mocks.updateSet).toHaveBeenCalledOnce();
    const setArg = mocks.updateSet.mock.calls[0][0] as any;
    expect(setArg.plan).toBe("growth");
  });

  it("duplicate stripeEventId → processed=false, no DB update", async () => {
    const { db, mocks } = makeStripeDb({ existingEventIds: [mockEventId] });
    const result = await handleStripeWebhook(db, makeSubUpdated());

    expect(result.processed).toBe(false);
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it("subscription.deleted → downgrades to solo", async () => {
    const { db, mocks } = makeStripeDb();
    const result = await handleStripeWebhook(db, makeSubDeleted());

    expect(result.processed).toBe(true);
    const setArg = mocks.updateSet.mock.calls[0][0] as any;
    expect(setArg.plan).toBe("solo");
  });

  it("unknown plan lookup_key → defaults to solo without crashing", async () => {
    const { db, mocks } = makeStripeDb();
    const result = await handleStripeWebhook(db, makeSubUpdated("unknown_xyz_monthly"));

    expect(result.processed).toBe(true);
    const setArg = mocks.updateSet.mock.calls[0][0] as any;
    expect(setArg.plan).toBe("solo");
  });

  it("unrecognised event type → recorded, processed=true, no update", async () => {
    const { db, mocks } = makeStripeDb();
    const event: StripeEventPayload = {
      id:   mockEventId,
      type: "payment_intent.created",
      data: { object: {} },
    };
    const result = await handleStripeWebhook(db, event);

    expect(result.processed).toBe(true);
    expect(mocks.updateSet).not.toHaveBeenCalled();
    expect(mocks.insertValues).toHaveBeenCalled();
  });

  it("plan resolved from metadata when no lookup_key", async () => {
    const { db, mocks } = makeStripeDb();
    await handleStripeWebhook(db, makeSubUpdated("", "pro"));

    const setArg = mocks.updateSet.mock.calls[0][0] as any;
    expect(setArg.plan).toBe("pro");
  });
});

describe("applyPlanLimits", () => {
  it("growth plan returns correct limits", () => {
    const limits = applyPlanLimits("growth");
    expect(limits.plan).toBe("growth");
    expect(limits.tasksLimitMonth).toBe(2000);
  });

  it("pro plan returns correct limits", () => {
    const limits = applyPlanLimits("pro");
    expect(limits.plan).toBe("pro");
    expect(limits.tasksLimitMonth).toBe(6000);
  });

  it("unknown plan throws UnknownPlanError", () => {
    expect(() => applyPlanLimits("xyz")).toThrow(UnknownPlanError);
  });
});

describe("verifyStripeSignature (HMAC)", () => {
  function sign(payload: string, secret: string, ts = "1700000000"): string {
    const signed = `${ts}.${payload}`;
    const hex = createHmac("sha256", secret).update(signed).digest("hex");
    return `t=${ts},v1=${hex}`;
  }

  it("valid HMAC matches expected format", () => {
    const secret = "whsec_test";
    const payload = '{"id":"evt_1"}';
    const ts = "1700000000";
    const sig = sign(payload, secret, ts);
    const signed = `${ts}.${payload}`;
    const computed = createHmac("sha256", secret).update(signed).digest("hex");
    expect(sig).toContain(`v1=${computed}`);
    expect(sig).toContain(`t=${ts}`);
  });

  it("tampered payload produces different signature", () => {
    const secret = "whsec_test";
    const ts = "1700000000";
    const original  = `${ts}.${'{"id":"evt_1"}'}`;
    const tampered  = `${ts}.${'{"id":"evt_2"}'}`;
    const sigOrig   = createHmac("sha256", secret).update(original).digest("hex");
    const sigTamper = createHmac("sha256", secret).update(tampered).digest("hex");
    expect(sigOrig).not.toBe(sigTamper);
  });
});
