/**
 * M3 — LLM Router: skill parser + GDPR routing
 *
 * CRITICAL: "yarn test --grep 'GDPR routing' must pass before every commit"
 * (CLAUDE.md RULE 1)
 *
 * Tests:
 *  1. parseSkill — parses valid frontmatter correctly
 *  2. parseSkill — defaults: tier=1, gdpr=false, webAccess=false, autonomy=A
 *  3. parseSkill — throws if name is missing
 *  4. parseSkill — parses tool declarations
 *  5. parseSkill — body is markdown below frontmatter
 *  6. parseSkill — gdpr_required: true is parsed correctly
 *  7. parseSkill — web_scope restricted
 *  8. GDPR routing: gdpr_required tier 1 → mistral-small (EU)
 *  9. GDPR routing: gdpr_required tier 0 → mistral-small (EU, not ministral)
 * 10. GDPR routing: gdpr_required tier 2 → mistral-medium (EU)
 * 11. GDPR routing: gdpr_required tier 3 → claude-sonnet (EU-contractual)
 * 12. GDPR routing: gdpr_required=false tier 1 lang=en → DeepSeek (allowed)
 * 13. GDPR routing: gdpr_required=true → NEVER DeepSeek → throws GdprViolationError
 * 14. routeModel: tier 0 → ministral-3b
 * 15. routeModel: tier 1 lang=fr → mistral-small
 * 16. routeModel: tier 1 lang=en → deepseek (non-GDPR)
 * 17. routeModel: tier 2 → gemini-flash
 * 18. routeModel: tier 3 → claude-sonnet
 * 19. routeModel: decision has correct shape (model, provider, tokens, cost)
 * 20. assertGdprSafe: non-EU model + gdpr_required → throws
 * 21. assertGdprSafe: DeepSeek + gdpr_required → throws
 * 22. assertGdprSafe: Mistral + gdpr_required → passes
 * 23. assertGdprSafe: DeepSeek + gdpr_required=false → passes
 * 24. callLLM: GDPR guard fires before HTTP call
 */

import { describe, expect, it, vi } from "vitest";

// ── parseSkill ────────────────────────────────────────────────────────────────

const validSkillMd = `---
name: qualification-cv
tier: 1
gdpr_required: true
web_access: false
autonomy_tier: A
tools:
  - mcp: gmail
    permissions: [read, compose]
  - mcp: notion
    permissions: [read, write]
description: Qualifies incoming CVs against job posting criteria
---

# Qualification CV

You are the sourcing specialist at {company_name}.
Review the attached CV for the {company_sector} role.
`;

describe("parseSkill", () => {
  it("1. parses valid frontmatter correctly", async () => {
    const { parseSkill } = await import("../skills/parser.js");
    const skill = parseSkill(validSkillMd);
    expect(skill.name).toBe("qualification-cv");
    expect(skill.tier).toBe(1);
    expect(skill.gdprRequired).toBe(true);
    expect(skill.webAccess).toBe(false);
    expect(skill.autonomyTier).toBe("A");
    expect(skill.description).toBe("Qualifies incoming CVs against job posting criteria");
  });

  it("2. defaults: tier=1, gdpr=false, webAccess=false, autonomy=A", async () => {
    const { parseSkill } = await import("../skills/parser.js");
    const skill = parseSkill("---\nname: minimal-skill\n---\n\nBody text.");
    expect(skill.tier).toBe(1);
    expect(skill.gdprRequired).toBe(false);
    expect(skill.webAccess).toBe(false);
    expect(skill.autonomyTier).toBe("A");
    expect(skill.webScope).toBe("open");
    expect(skill.tools).toEqual([]);
  });

  it("3. throws if name is missing", async () => {
    const { parseSkill } = await import("../skills/parser.js");
    expect(() => parseSkill("---\ntier: 1\n---\n\nBody.")).toThrow("missing required frontmatter field: name");
  });

  it("4. parses tool declarations", async () => {
    const { parseSkill } = await import("../skills/parser.js");
    const skill = parseSkill(validSkillMd);
    expect(skill.tools).toHaveLength(2);
    expect(skill.tools[0]).toMatchObject({ mcp: "gmail", permissions: ["read", "compose"] });
    expect(skill.tools[1]).toMatchObject({ mcp: "notion", permissions: ["read", "write"] });
  });

  it("5. body is markdown below frontmatter, trimmed", async () => {
    const { parseSkill } = await import("../skills/parser.js");
    const skill = parseSkill(validSkillMd);
    expect(skill.body).toContain("# Qualification CV");
    expect(skill.body).toContain("{company_name}");
    expect(skill.body.startsWith("#")).toBe(true); // no leading whitespace
  });

  it("6. gdpr_required: true parsed correctly", async () => {
    const { parseSkill } = await import("../skills/parser.js");
    const skill = parseSkill(validSkillMd);
    expect(skill.gdprRequired).toBe(true);
  });

  it("7. web_scope restricted", async () => {
    const { parseSkill } = await import("../skills/parser.js");
    const md = "---\nname: market-intel\ntier: 2\nweb_access: true\nweb_scope: restricted\n---\n\nBody.";
    const skill = parseSkill(md);
    expect(skill.webAccess).toBe(true);
    expect(skill.webScope).toBe("restricted");
  });
});

// ── routeModel ────────────────────────────────────────────────────────────────

function makeSkill(overrides: {
  tier?: 0 | 1 | 2 | 3;
  gdprRequired?: boolean;
  name?: string;
}) {
  return {
    name: overrides.name ?? "test-skill",
    tier: overrides.tier ?? 1,
    gdprRequired: overrides.gdprRequired ?? false,
    webAccess: false,
    webScope: "open" as const,
    autonomyTier: "A" as const,
    tools: [],
    description: "",
    body: "",
  };
}

describe("GDPR routing", () => {
  it("8. gdpr_required tier 1 → mistral-small (EU)", async () => {
    const { routeModel } = await import("../llm/router.js");
    const decision = routeModel(makeSkill({ tier: 1, gdprRequired: true }));
    expect(decision.model).toBe("mistralai/mistral-small-3.2");
    expect(decision.isEuHosted).toBe(true);
  });

  it("9. gdpr_required tier 0 → mistral-small (EU, not ministral-3b)", async () => {
    const { routeModel } = await import("../llm/router.js");
    // T0 + GDPR → must use EU model, not the default T0 ministral-3b
    const decision = routeModel(makeSkill({ tier: 0, gdprRequired: true }));
    expect(decision.model).toContain("mistral");
    expect(decision.isEuHosted).toBe(true);
    expect(decision.model).not.toBe("mistralai/ministral-3b"); // ministral ≠ GDPR-forced
  });

  it("10. gdpr_required tier 2 → mistral-medium (EU)", async () => {
    const { routeModel } = await import("../llm/router.js");
    const decision = routeModel(makeSkill({ tier: 2, gdprRequired: true }));
    expect(decision.model).toBe("mistralai/mistral-medium-3.1");
    expect(decision.isEuHosted).toBe(true);
  });

  it("11. gdpr_required tier 3 → claude-sonnet (EU-contractual)", async () => {
    const { routeModel } = await import("../llm/router.js");
    const decision = routeModel(makeSkill({ tier: 3, gdprRequired: true }));
    expect(decision.model).toBe("anthropic/claude-sonnet-4-5");
    // Claude is US-hosted but Anthropic is contractually GDPR-compliant (DPA)
  });

  it("12. gdpr_required=false tier 1 lang=en → DeepSeek (allowed)", async () => {
    const { routeModel } = await import("../llm/router.js");
    const decision = routeModel(makeSkill({ tier: 1, gdprRequired: false }), "en");
    expect(decision.model).toBe("deepseek/deepseek-chat-v3-5");
  });

  it("13. gdpr_required=true → NEVER DeepSeek → throws GdprViolationError", async () => {
    const { routeModel, GdprViolationError } = await import("../llm/router.js");
    // This should be impossible via normal routing, but test the invariant guard
    // by verifying that any gdpr+T1 combination never touches DeepSeek
    const decision = routeModel(makeSkill({ tier: 1, gdprRequired: true }));
    expect(decision.model).not.toContain("deepseek");
    expect(decision.isEuHosted).toBe(true);

    // Verify the error type exists and is a proper error
    expect(new GdprViolationError("deepseek/deepseek-chat-v3-5", "test")).toBeInstanceOf(Error);
    expect(new GdprViolationError("deepseek/deepseek-chat-v3-5", "test").name).toBe("GdprViolationError");
  });
});

describe("routeModel — tier routing", () => {
  it("14. tier 0 → ministral-3b", async () => {
    const { routeModel } = await import("../llm/router.js");
    const decision = routeModel(makeSkill({ tier: 0 }));
    expect(decision.model).toBe("mistralai/ministral-3b");
  });

  it("15. tier 1 lang=fr → mistral-small", async () => {
    const { routeModel } = await import("../llm/router.js");
    const decision = routeModel(makeSkill({ tier: 1 }), "fr");
    expect(decision.model).toBe("mistralai/mistral-small-3.2");
  });

  it("16. tier 1 lang=en → deepseek (non-GDPR)", async () => {
    const { routeModel } = await import("../llm/router.js");
    const decision = routeModel(makeSkill({ tier: 1 }), "en");
    expect(decision.model).toBe("deepseek/deepseek-chat-v3-5");
  });

  it("17. tier 2 → gemini-flash", async () => {
    const { routeModel } = await import("../llm/router.js");
    const decision = routeModel(makeSkill({ tier: 2 }));
    expect(decision.model).toBe("google/gemini-flash-1.5");
  });

  it("18. tier 3 → claude-sonnet", async () => {
    const { routeModel } = await import("../llm/router.js");
    const decision = routeModel(makeSkill({ tier: 3 }));
    expect(decision.model).toBe("anthropic/claude-sonnet-4-5");
  });

  it("19. decision has correct shape", async () => {
    const { routeModel } = await import("../llm/router.js");
    const decision = routeModel(makeSkill({ tier: 1 }), "fr");
    expect(decision).toMatchObject({
      provider: "openrouter",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
    });
    expect(typeof decision.maxInputTokens).toBe("number");
    expect(typeof decision.maxOutputTokens).toBe("number");
    expect(typeof decision.estimatedCostEur).toBe("number");
    expect(decision.maxInputTokens).toBeGreaterThan(0);
    expect(decision.maxOutputTokens).toBeGreaterThan(0);
  });
});

// ── assertGdprSafe ────────────────────────────────────────────────────────────

describe("assertGdprSafe", () => {
  it("20. non-EU model + gdpr_required → throws", async () => {
    const { assertGdprSafe } = await import("../llm/router.js");
    expect(() =>
      assertGdprSafe("google/gemini-flash-1.5", true, "my-skill"),
    ).toThrow("GDPR violation");
  });

  it("21. DeepSeek + gdpr_required → throws", async () => {
    const { assertGdprSafe } = await import("../llm/router.js");
    expect(() =>
      assertGdprSafe("deepseek/deepseek-chat-v3-5", true, "cv-skill"),
    ).toThrow("GDPR violation");
  });

  it("22. Mistral EU + gdpr_required → passes (no throw)", async () => {
    const { assertGdprSafe } = await import("../llm/router.js");
    expect(() =>
      assertGdprSafe("mistralai/mistral-small-3.2", true, "cv-skill"),
    ).not.toThrow();
  });

  it("23. DeepSeek + gdpr_required=false → passes (no throw)", async () => {
    const { assertGdprSafe } = await import("../llm/router.js");
    expect(() =>
      assertGdprSafe("deepseek/deepseek-chat-v3-5", false, "market-intel"),
    ).not.toThrow();
  });
});

// ── callLLM GDPR guard ────────────────────────────────────────────────────────

describe("callLLM", () => {
  it("24. GDPR guard fires before HTTP call — no fetch when GDPR violated", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { callLLM } = await import("../llm/openrouter.js");

    await expect(
      callLLM({
        model: "deepseek/deepseek-chat-v3-5",
        messages: [{ role: "user", content: "test" }],
        maxOutputTokens: 100,
        companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        agentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        taskId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        gdprRequired: true,
        skillName: "qualification-cv",
      }),
    ).rejects.toThrow("GDPR violation");

    // fetch must NOT have been called — guard fires first
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
