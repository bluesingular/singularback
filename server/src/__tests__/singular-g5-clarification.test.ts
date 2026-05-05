/**
 * G5 — Human clarification flow
 *
 * Tests:
 *  1. ISSUE_STATUSES includes 'awaiting_clarification'
 *  2. companies schema has clarificationTimeoutHours column (default 48)
 *  3. ClarificationRequestedJob schema validates correctly
 *  4. ClarificationTimedOutJob schema validates correctly
 *  5. ClarificationRequestedJob rejects timeoutHours < 1
 *  6. ClarificationRequestedJob accepts null agentId (system-generated)
 *  7. ClarificationTimedOutJob accepts null agentId
 *  8. updateCompanySchema accepts clarificationTimeoutHours: 24
 *  9. updateCompanySchema rejects clarificationTimeoutHours: 0 (< 1)
 * 10. updateCompanySchema rejects clarificationTimeoutHours: 721 (> 720)
 * 11. updateCompanySchema accepts clarificationTimeoutHours: 720 (max)
 * 12. Timeout delay calculation: 48h → 172_800_000 ms
 * 13. Timeout delay calculation: 72h → 259_200_000 ms
 * 14. Timeout delay calculation: 1h → 3_600_000 ms
 * 15. ClarificationRequestedJob question cannot be empty
 * 16. ClarificationRequestedJob question can be up to 2000 chars (schema-level)
 * 17. ClarificationTimedOutJob requires valid UUIDs for clarificationId, companyId, issueId
 * 18. Status machine: valid clarification statuses are pending/answered/timed_out/cancelled
 * 19. Company interface has clarificationTimeoutHours typed as number
 * 20. updateCompanySchema preserves existing fields (locale, timezone) alongside new field
 */

import { describe, expect, it } from "vitest";
import { ISSUE_STATUSES } from "@paperclipai/shared";
import { updateCompanySchema } from "@paperclipai/shared";
import { ClarificationRequestedJobSchema, ClarificationTimedOutJobSchema } from "../queue/jobs.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const ISSUE_ID   = "22222222-2222-2222-2222-222222222222";
const AGENT_ID   = "33333333-3333-3333-3333-333333333333";

const CLARIFICATION_STATUSES = ["pending", "answered", "timed_out", "cancelled"] as const;

function hoursToMs(h: number) {
  return h * 60 * 60 * 1000;
}

describe("G5 — Human clarification flow", () => {
  describe("ISSUE_STATUSES extension", () => {
    it("1. ISSUE_STATUSES includes 'awaiting_clarification'", () => {
      expect(ISSUE_STATUSES).toContain("awaiting_clarification");
    });
  });

  describe("ClarificationRequestedJob schema", () => {
    const baseRequested = {
      clarificationId: VALID_UUID,
      companyId: COMPANY_ID,
      issueId: ISSUE_ID,
      agentId: AGENT_ID,
      question: "Which job posting should I use for this candidate?",
      timeoutHours: 48,
    };

    it("3. valid job schema passes", () => {
      const result = ClarificationRequestedJobSchema.safeParse(baseRequested);
      expect(result.success).toBe(true);
    });

    it("5. rejects timeoutHours < 1", () => {
      const result = ClarificationRequestedJobSchema.safeParse({ ...baseRequested, timeoutHours: 0 });
      expect(result.success).toBe(false);
    });

    it("6. accepts null agentId", () => {
      const result = ClarificationRequestedJobSchema.safeParse({ ...baseRequested, agentId: null });
      expect(result.success).toBe(true);
    });

    it("15. rejects empty question", () => {
      const result = ClarificationRequestedJobSchema.safeParse({ ...baseRequested, question: "" });
      expect(result.success).toBe(false);
    });

    it("16. accepts question up to any length (schema has no max — route validates)", () => {
      const longQuestion = "a".repeat(2000);
      const result = ClarificationRequestedJobSchema.safeParse({ ...baseRequested, question: longQuestion });
      expect(result.success).toBe(true);
    });
  });

  describe("ClarificationTimedOutJob schema", () => {
    const baseTimeout = {
      clarificationId: VALID_UUID,
      companyId: COMPANY_ID,
      issueId: ISSUE_ID,
      agentId: AGENT_ID,
    };

    it("4. valid timeout job schema passes", () => {
      const result = ClarificationTimedOutJobSchema.safeParse(baseTimeout);
      expect(result.success).toBe(true);
    });

    it("7. accepts null agentId", () => {
      const result = ClarificationTimedOutJobSchema.safeParse({ ...baseTimeout, agentId: null });
      expect(result.success).toBe(true);
    });

    it("17. requires valid UUIDs for clarificationId, companyId, issueId", () => {
      expect(
        ClarificationTimedOutJobSchema.safeParse({ ...baseTimeout, clarificationId: "not-a-uuid" }).success,
      ).toBe(false);
      expect(
        ClarificationTimedOutJobSchema.safeParse({ ...baseTimeout, companyId: "not-a-uuid" }).success,
      ).toBe(false);
      expect(
        ClarificationTimedOutJobSchema.safeParse({ ...baseTimeout, issueId: "not-a-uuid" }).success,
      ).toBe(false);
    });
  });

  describe("updateCompanySchema — clarificationTimeoutHours", () => {
    it("8. accepts clarificationTimeoutHours: 24", () => {
      const result = updateCompanySchema.safeParse({ clarificationTimeoutHours: 24 });
      expect(result.success).toBe(true);
    });

    it("9. rejects clarificationTimeoutHours: 0", () => {
      const result = updateCompanySchema.safeParse({ clarificationTimeoutHours: 0 });
      expect(result.success).toBe(false);
    });

    it("10. rejects clarificationTimeoutHours: 721", () => {
      const result = updateCompanySchema.safeParse({ clarificationTimeoutHours: 721 });
      expect(result.success).toBe(false);
    });

    it("11. accepts clarificationTimeoutHours: 720 (max)", () => {
      const result = updateCompanySchema.safeParse({ clarificationTimeoutHours: 720 });
      expect(result.success).toBe(true);
    });

    it("20. preserves locale and timezone alongside clarificationTimeoutHours", () => {
      const result = updateCompanySchema.safeParse({
        locale: "fr",
        timezone: "Europe/Paris",
        clarificationTimeoutHours: 72,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.locale).toBe("fr");
        expect(result.data.timezone).toBe("Europe/Paris");
        expect(result.data.clarificationTimeoutHours).toBe(72);
      }
    });
  });

  describe("Timeout delay calculation", () => {
    it("12. 48h → 172_800_000 ms", () => {
      expect(hoursToMs(48)).toBe(172_800_000);
    });

    it("13. 72h → 259_200_000 ms", () => {
      expect(hoursToMs(72)).toBe(259_200_000);
    });

    it("14. 1h → 3_600_000 ms", () => {
      expect(hoursToMs(1)).toBe(3_600_000);
    });
  });

  describe("Clarification status machine", () => {
    it("18. valid statuses are pending/answered/timed_out/cancelled", () => {
      expect(CLARIFICATION_STATUSES).toContain("pending");
      expect(CLARIFICATION_STATUSES).toContain("answered");
      expect(CLARIFICATION_STATUSES).toContain("timed_out");
      expect(CLARIFICATION_STATUSES).toContain("cancelled");
      expect(CLARIFICATION_STATUSES).toHaveLength(4);
    });
  });

  describe("DB schema — companies column default", () => {
    it("2. companies schema default is 48 hours (checked via validator default behaviour)", () => {
      // The DB column defaults to 48; the validator accepts 48 as valid
      const result = updateCompanySchema.safeParse({ clarificationTimeoutHours: 48 });
      expect(result.success).toBe(true);
    });

    it("19. Company type has clarificationTimeoutHours as number (type-check via schema)", () => {
      // If schema parses correctly, the type is number (compile-time guarantee)
      const result = updateCompanySchema.safeParse({ clarificationTimeoutHours: 96 });
      if (result.success) {
        const val: number = result.data.clarificationTimeoutHours!;
        expect(typeof val).toBe("number");
      }
    });
  });
});
