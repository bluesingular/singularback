/**
 * M2 — Context Assembly Pipeline
 *
 * Tests:
 *  1. estimateTokens — basic counting
 *  2. estimateTokensTotal — sums across strings
 *  3. truncateToTokens — respects budget
 *  4. truncateToTokens — short text unchanged
 *  5. getDnaCompressed — returns key fields only, omits empty
 *  6. getDnaFull — returns structured markdown with all sections
 *  7. getDna — returns null when no DNA exists
 *  8. assembleContext — returns all 6 layers
 *  9. assembleContext — T0 uses compressed DNA
 * 10. assembleContext — T2 uses full DNA
 * 11. assembleContext — task is NEVER truncated (RULE 5)
 * 12. assembleContext — totalTokens is sum of all layers
 * 13. assembleContext — memory chunks respected
 * 14. assembleContext — skill variables interpolated
 * 15. contextToMessages — system = identity+dna+skill, user = task+memory+outputs
 * 16. retrieveMemory — returns empty when no entries
 * 17. retrieveMemory — respects maxChunks limit
 * 18. retrieveMemory — respects maxTokens budget
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const agentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const agent = {
  id: agentId,
  name: "Sophie",
  companyId,
  description: "Sourcing specialist focused on tech recruitment.",
};

const task = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  title: "Qualify CV of Jean Dupont",
  description: "The candidate applied for the Senior Dev role. Review their background.",
  priority: "high",
};

const company = {
  id: companyId,
  name: "Agence Alpha",
  sector: "recruitment",
};

const skill = {
  name: "qualification-cv",
  description: "Qualifies incoming CVs against active job posting criteria.",
  body: "You work at {company_name} in {company_sector}. Agent: {agent_name}. Review the CV carefully.",
};

const mockDnaRow = {
  description: "Top French recruitment agency.",
  customerProfile: "SMBs in tech and finance.",
  tone: "professional",
  brandRules: "Always use formal language.",
  regulatoryContext: "GDPR compliant, French labour law applies.",
  forbiddenTopics: ["politics", "religion"],
  terminology: { CV: "résumé", "job posting": "annonce" },
  competitors: ["Hays", "Michael Page"],
};

// ── Token utilities ───────────────────────────────────────────────────────────

describe("estimateTokens", () => {
  it("1. basic counting — 4 chars per token", async () => {
    const { estimateTokens } = await import("../context/tokens.js");
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(400))).toBe(100);
    expect(estimateTokens("")).toBe(0);
  });

  it("2. estimateTokensTotal — sums across strings", async () => {
    const { estimateTokensTotal } = await import("../context/tokens.js");
    expect(estimateTokensTotal(["abcd", "abcd"])).toBe(2);
    expect(estimateTokensTotal([])).toBe(0);
  });

  it("3. truncateToTokens — respects budget", async () => {
    const { truncateToTokens } = await import("../context/tokens.js");
    const long = "a".repeat(1000);
    const result = truncateToTokens(long, 10); // 10 tokens = 40 chars
    expect(result.length).toBeLessThanOrEqual(45); // 40 + "…"
  });

  it("4. truncateToTokens — short text unchanged", async () => {
    const { truncateToTokens } = await import("../context/tokens.js");
    const short = "Hello world";
    expect(truncateToTokens(short, 100)).toBe(short);
  });
});

// ── DNA service ───────────────────────────────────────────────────────────────

function makeDnaDb(row: typeof mockDnaRow | null) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(row ? [row] : []),
    }),
  };
}

describe("getDna / getDnaCompressed / getDnaFull", () => {
  it("5. getDnaCompressed — returns key fields, skips empty", async () => {
    const { getDnaCompressed } = await vi.importActual<typeof import("../context/dna.js")>("../context/dna.js");
    const db = makeDnaDb(mockDnaRow);
    const result = await getDnaCompressed(db as any, companyId);
    expect(result).toContain("Top French recruitment agency");
    expect(result).toContain("SMBs in tech");
    expect(result).toContain("professional");
    expect(result).toContain("politics");
    // Should NOT contain full brand rules (those are only in getDnaFull)
    expect(result).not.toContain("formal language");
  });

  it("6. getDnaFull — returns structured markdown with all sections", async () => {
    const { getDnaFull } = await vi.importActual<typeof import("../context/dna.js")>("../context/dna.js");
    const db = makeDnaDb(mockDnaRow);
    const result = await getDnaFull(db as any, companyId);
    expect(result).toContain("## Company Identity");
    expect(result).toContain("## Brand Rules");
    expect(result).toContain("Always use formal language");
    expect(result).toContain("## Regulatory Context");
    expect(result).toContain("GDPR");
    expect(result).toContain("## Forbidden Topics");
    expect(result).toContain("## Terminology");
    expect(result).toContain("résumé");
    expect(result).toContain("## Competitors");
    expect(result).toContain("Hays");
  });

  it("7. getDna — returns null when no DNA exists", async () => {
    const { getDna } = await vi.importActual<typeof import("../context/dna.js")>("../context/dna.js");
    const db = makeDnaDb(null);
    const result = await getDna(db as any, companyId);
    expect(result).toBeNull();
  });
});

// ── Memory retrieval ──────────────────────────────────────────────────────────

function makeMemoryDb(entries: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(entries),
    }),
  };
}

describe("retrieveMemory", () => {
  it("16. returns empty when no memory entries", async () => {
    const { retrieveMemory } = await vi.importActual<typeof import("../context/memory.js")>("../context/memory.js");
    const db = makeMemoryDb([]);
    const result = await retrieveMemory(db as any, {
      companyId,
      query: "test",
      maxChunks: 5,
      maxTokens: 2000,
    });
    expect(result.text).toBe("");
    expect(result.chunksUsed).toBe(0);
  });

  it("17. respects maxChunks limit", async () => {
    const { retrieveMemory } = await vi.importActual<typeof import("../context/memory.js")>("../context/memory.js");
    const entries = Array.from({ length: 10 }, (_, i) => ({
      id: `id-${i}`,
      title: `Memory ${i}`,
      content: `Content of memory ${i}`,
      importance: 3,
    }));
    const db = makeMemoryDb(entries);
    const result = await retrieveMemory(db as any, {
      companyId,
      query: "test",
      maxChunks: 3,
      maxTokens: 10000,
    });
    expect(result.chunksUsed).toBeLessThanOrEqual(3);
  });

  it("18. respects maxTokens budget", async () => {
    const { retrieveMemory } = await vi.importActual<typeof import("../context/memory.js")>("../context/memory.js");
    // Each entry is ~50 chars ≈ 13 tokens
    const entries = Array.from({ length: 5 }, (_, i) => ({
      id: `id-${i}`,
      title: `Memory title ${i}`,
      content: `This is a relatively long content for memory entry number ${i}.`,
      importance: 3,
    }));
    const db = makeMemoryDb(entries);
    const result = await retrieveMemory(db as any, {
      companyId,
      query: "test",
      maxChunks: 10,
      maxTokens: 20, // very tight budget — fits ~1-2 entries
    });
    // Should have fewer chunks than available due to token limit
    expect(result.chunksUsed).toBeLessThan(5);
  });
});

// ── assembleContext ───────────────────────────────────────────────────────────

// Mock the dna + memory modules for assembler tests
vi.mock("../context/dna.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../context/dna.js")>();
  return {
    ...actual,
    getDnaCompressed: vi.fn().mockResolvedValue("Company: Agence Alpha\nTone: professional"),
    getDnaFull: vi.fn().mockResolvedValue("## Company Identity\n**Description:** Agence Alpha"),
  };
});

vi.mock("../context/memory.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../context/memory.js")>();
  return {
    ...actual,
    retrieveMemory: vi.fn().mockResolvedValue({
      text: "[Memory] Past candidate: Strong profile.\n",
      chunksUsed: 1,
    }),
  };
});

describe("assembleContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("8. returns all 6 layers", async () => {
    const { assembleContext } = await import("../context/assembler.js");
    const result = await assembleContext({} as any, { agent, task, company, skill, tier: "T1" });

    expect(result.systemIdentity).toBeTruthy();
    expect(result.companyDna).toBeTruthy();
    expect(result.currentTask).toBeTruthy();
    expect(result.orgMemory).toBeTruthy();
    expect(result.skillInstructions).toBeTruthy();
    expect(typeof result.totalTokens).toBe("number");
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it("9. T0 uses getDnaCompressed", async () => {
    const { assembleContext } = await import("../context/assembler.js");
    const dna = await import("../context/dna.js");
    await assembleContext({} as any, { agent, task, company, skill, tier: "T0" });
    expect(dna.getDnaCompressed).toHaveBeenCalledWith(expect.anything(), companyId);
    expect(dna.getDnaFull).not.toHaveBeenCalled();
  });

  it("10. T2 uses getDnaFull", async () => {
    const { assembleContext } = await import("../context/assembler.js");
    const dna = await import("../context/dna.js");
    await assembleContext({} as any, { agent, task, company, skill, tier: "T2" });
    expect(dna.getDnaFull).toHaveBeenCalledWith(expect.anything(), companyId);
    expect(dna.getDnaCompressed).not.toHaveBeenCalled();
  });

  it("11. currentTask contains title and description (RULE 5 — never truncated)", async () => {
    const { assembleContext } = await import("../context/assembler.js");
    const result = await assembleContext({} as any, { agent, task, company, skill, tier: "T1" });
    expect(result.currentTask).toContain(task.title);
    expect(result.currentTask).toContain(task.description!);
  });

  it("12. totalTokens is positive and roughly correct", async () => {
    const { assembleContext } = await import("../context/assembler.js");
    const result = await assembleContext({} as any, { agent, task, company, skill, tier: "T1" });
    // Must be > 0 and within the T1 total budget (5000 tokens)
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.totalTokens).toBeLessThan(5000);
  });

  it("13. memoryChunksUsed comes from retrieveMemory", async () => {
    const { assembleContext } = await import("../context/assembler.js");
    const result = await assembleContext({} as any, { agent, task, company, skill, tier: "T1" });
    expect(result.memoryChunksUsed).toBe(1);
  });

  it("14. skill body variables are interpolated", async () => {
    const { assembleContext } = await import("../context/assembler.js");
    const result = await assembleContext({} as any, { agent, task, company, skill, tier: "T1" });
    expect(result.skillInstructions).toContain(company.name);
    expect(result.skillInstructions).toContain(company.sector!);
    expect(result.skillInstructions).toContain(agent.name);
    // Original template placeholders should be replaced
    expect(result.skillInstructions).not.toContain("{company_name}");
    expect(result.skillInstructions).not.toContain("{agent_name}");
  });
});

// ── contextToMessages ─────────────────────────────────────────────────────────

describe("contextToMessages", () => {
  it("15. system = identity+dna+skill, user = task+memory+outputs", async () => {
    const { contextToMessages } = await import("../context/assembler.js");

    const ctx = {
      systemIdentity: "You are Sophie.",
      companyDna: "Company: Agence Alpha.",
      currentTask: "## Current Task: Qualify CV",
      orgMemory: "[Memory] Past: Good.",
      recentOutputs: "## Recent Work\n- Previous task",
      skillInstructions: "Review CVs carefully.",
      totalTokens: 50,
      memoryChunksUsed: 1,
      compressionApplied: false,
    };

    const messages = contextToMessages(ctx);
    expect(messages).toHaveLength(2);

    const [system, user] = messages;
    expect(system.role).toBe("system");
    expect(system.content).toContain("You are Sophie");
    expect(system.content).toContain("Agence Alpha");
    expect(system.content).toContain("Review CVs");

    expect(user.role).toBe("user");
    expect(user.content).toContain("Qualify CV");
    expect(user.content).toContain("[Memory]");
    expect(user.content).toContain("Recent Work");
  });
});
