/**
 * G4 — Inbound webhooks
 *
 * Tests:
 *  1. isUuid detects UUID format correctly
 *  2. isUuid rejects agent slugs
 *  3. detectSource: returns "slack" for x-slack-signature header
 *  4. detectSource: returns "github" for x-hub-signature-256 header
 *  5. detectSource: returns "stripe" for stripe-signature header
 *  6. detectSource: returns "custom" for unknown headers
 *  7. verifyWebhookSignature: valid HMAC passes
 *  8. verifyWebhookSignature: tampered body fails
 *  9. verifyWebhookSignature: missing header returns false
 * 10. RoutingRule condition: exists op matches when field present
 * 11. RoutingRule condition: exists op rejects when field absent
 * 12. RoutingRule condition: eq op matches exact value
 * 13. RoutingRule condition: eq op rejects different value
 * 14. RoutingRule condition: contains op matches substring
 * 15. RoutingRule condition: no condition always matches
 * 16. WebhookReceivedJob schema: endpointId nullable UUID accepted
 * 17. WebhookReceivedJob schema: null endpointId accepted (legacy path)
 * 18. WebhookReceivedJob schema: routingRules default to empty array
 * 19. Routing rule with heartbeat action validates agentId is UUID
 * 20. log_only action is valid without agentId
 */

import { describe, expect, it } from "vitest";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WebhookReceivedJobSchema, type RoutingRule } from "../queue/jobs.js";

// ── Replicate private helpers for testing ─────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

type WebhookSource = "indeed" | "calendly" | "slack" | "github" | "stripe" | "custom";

function detectSource(headers: Record<string, string>): WebhookSource {
  if (headers["x-indeed-signature"]) return "indeed";
  if (headers["x-calendly-webhook-signature"]) return "calendly";
  if (headers["x-slack-signature"]) return "slack";
  if (headers["x-hub-signature-256"]) return "github";
  if (headers["stripe-signature"]) return "stripe";
  return "custom";
}

function verifyHmac(body: string, secret: string, header: string): boolean {
  try {
    if (!header) return false;
    const computed = createHmac("sha256", secret).update(body).digest("hex");
    const computedBuf = Buffer.from(computed, "hex");
    const receivedBuf = Buffer.from(header, "hex");
    if (computedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(computedBuf, receivedBuf);
  } catch {
    return false;
  }
}

function getNestedValue(payload: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((obj, key) => {
    if (obj != null && typeof obj === "object") {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}

function matchesCondition(
  condition: RoutingRule["condition"],
  payload: Record<string, unknown>,
): boolean {
  if (!condition) return true;
  const value = getNestedValue(payload, condition.field);
  switch (condition.op) {
    case "exists": return value !== undefined && value !== null;
    case "eq": return String(value) === condition.value;
    case "contains": return typeof value === "string" && value.includes(condition.value ?? "");
    default: return false;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const COMPANY_ID = "11111111-1111-1111-1111-111111111111";

describe("G4 — inbound webhooks", () => {
  describe("UUID detection", () => {
    it("1. isUuid detects UUID format correctly", () => {
      expect(isUuid(VALID_UUID)).toBe(true);
    });

    it("2. isUuid rejects agent slugs", () => {
      expect(isUuid("sophie-sourcing")).toBe(false);
      expect(isUuid("marc-client")).toBe(false);
      expect(isUuid("not-a-uuid")).toBe(false);
    });
  });

  describe("Source detection", () => {
    it("3. detectSource returns 'slack' for x-slack-signature", () => {
      expect(detectSource({ "x-slack-signature": "v0=abc123" })).toBe("slack");
    });

    it("4. detectSource returns 'github' for x-hub-signature-256", () => {
      expect(detectSource({ "x-hub-signature-256": "sha256=abc" })).toBe("github");
    });

    it("5. detectSource returns 'stripe' for stripe-signature", () => {
      expect(detectSource({ "stripe-signature": "t=123,v1=abc" })).toBe("stripe");
    });

    it("6. detectSource returns 'custom' for unknown headers", () => {
      expect(detectSource({ "x-unknown-header": "value" })).toBe("custom");
      expect(detectSource({})).toBe("custom");
    });
  });

  describe("HMAC verification", () => {
    const secret = "super-secret-key-for-testing";
    const body = JSON.stringify({ event: "application.submitted", candidateId: "cand-123" });

    it("7. valid HMAC passes", () => {
      const computed = createHmac("sha256", secret).update(body).digest("hex");
      const result = verifyHmac(body, secret, computed);
      expect(result).toBe(true);
    });

    it("8. tampered body fails", () => {
      const computed = createHmac("sha256", secret).update(body).digest("hex");
      const tamperedBody = JSON.stringify({ event: "application.submitted", candidateId: "cand-456" });
      const result = verifyHmac(tamperedBody, secret, computed);
      expect(result).toBe(false);
    });

    it("9. missing/empty header returns false", () => {
      const result = verifyHmac(body, secret, "");
      expect(result).toBe(false);
    });
  });

  describe("Routing rule condition matching", () => {
    const payload = {
      event: "application.submitted",
      data: {
        status: "new",
        source: "indeed",
      },
    };

    it("10. exists op matches when field present", () => {
      expect(matchesCondition({ field: "event", op: "exists" }, payload)).toBe(true);
      expect(matchesCondition({ field: "data.status", op: "exists" }, payload)).toBe(true);
    });

    it("11. exists op rejects when field absent", () => {
      expect(matchesCondition({ field: "nonexistent", op: "exists" }, payload)).toBe(false);
      expect(matchesCondition({ field: "data.missing", op: "exists" }, payload)).toBe(false);
    });

    it("12. eq op matches exact value", () => {
      expect(
        matchesCondition({ field: "event", op: "eq", value: "application.submitted" }, payload),
      ).toBe(true);
    });

    it("13. eq op rejects different value", () => {
      expect(
        matchesCondition({ field: "event", op: "eq", value: "application.rejected" }, payload),
      ).toBe(false);
    });

    it("14. contains op matches substring", () => {
      expect(
        matchesCondition({ field: "event", op: "contains", value: "application" }, payload),
      ).toBe(true);
    });

    it("15. no condition always matches", () => {
      expect(matchesCondition(undefined, payload)).toBe(true);
      expect(matchesCondition(undefined, {})).toBe(true);
    });
  });

  describe("WebhookReceivedJob schema", () => {
    const base = {
      companyId: COMPANY_ID,
      source: "indeed",
      payload: { event: "test" },
      receivedAt: new Date().toISOString(),
    };

    it("16. endpointId as valid UUID is accepted", () => {
      const result = WebhookReceivedJobSchema.safeParse({
        ...base,
        endpointId: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    it("17. null endpointId accepted (legacy path)", () => {
      const result = WebhookReceivedJobSchema.safeParse({
        ...base,
        endpointId: null,
      });
      expect(result.success).toBe(true);
    });

    it("18. routingRules default to empty array when omitted", () => {
      const result = WebhookReceivedJobSchema.safeParse({
        ...base,
        endpointId: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.routingRules).toEqual([]);
      }
    });

    it("19. heartbeat action with valid agentId is accepted", () => {
      const result = WebhookReceivedJobSchema.safeParse({
        ...base,
        endpointId: VALID_UUID,
        routingRules: [
          {
            condition: { field: "event", op: "eq", value: "application.submitted" },
            action: { type: "heartbeat", agentId: COMPANY_ID },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("20. log_only action valid without agentId", () => {
      const result = WebhookReceivedJobSchema.safeParse({
        ...base,
        endpointId: null,
        routingRules: [
          {
            action: { type: "log_only" },
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });
});
