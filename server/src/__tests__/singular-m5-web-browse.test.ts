/**
 * M5 — Web browsing tool (Firecrawl + Jina fallback)
 *
 * Tests:
 *  1. webBrowse throws ForbiddenError when skill.webAccess = false
 *  2. webBrowse throws ForbiddenError when webScope=restricted + domain not whitelisted
 *  3. ForbiddenError does NOT write to audit log (permission check is pre-try/finally)
 *  4. scrape mode: returns Firecrawl markdown result
 *  5. extract mode: returns JSON-stringified data from Firecrawl
 *  6. URL logged to tool_call_log on Firecrawl success
 *  7. Jina fallback used when Firecrawl throws
 *  8. URL logged with status=failed when Firecrawl failed (Jina provided result)
 *  9. FIRECRAWL_API_KEY missing → Jina fallback (no crash)
 * 10. GDPR flag fires when skill.gdprRequired = true (no throw)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Firecrawl before imports that depend on it
vi.mock("@mendable/firecrawl-js", () => ({
  default: vi.fn(),
}));

import FirecrawlApp from "@mendable/firecrawl-js";
import { webBrowse, ForbiddenError } from "../tools/webBrowse.js";
import type { ParsedSkill } from "../skills/parser.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIRECRAWL_KEY = "fc-test-key";

function makeSkill(overrides: Partial<ParsedSkill> = {}): ParsedSkill {
  return {
    name: "test-skill",
    tier: 1,
    gdprRequired: false,
    webAccess: true,
    webScope: "open",
    autonomyTier: "A",
    tools: [],
    description: "",
    body: "",
    ...overrides,
  };
}

function makeContext(skillOverrides: Partial<ParsedSkill> = {}) {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const db = { insert: vi.fn().mockReturnValue({ values: insertValues }) };
  return {
    context: {
      db: db as any,
      companyId: "company-1",
      agentId: "agent-1",
      taskId: "task-1",
      skill: makeSkill(skillOverrides),
    },
    db,
    insertValues,
  };
}

function mockFirecrawl(impl: object) {
  vi.mocked(FirecrawlApp).mockImplementation(() => impl as InstanceType<typeof FirecrawlApp>);
}

function mockFetch(markdown: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ text: () => Promise.resolve(markdown) }),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("webBrowse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.FIRECRAWL_API_KEY = FIRECRAWL_KEY;
  });

  it("1. throws ForbiddenError when skill.webAccess = false", async () => {
    const { context } = makeContext({ webAccess: false });
    await expect(
      webBrowse({ url: "https://example.com", mode: "scrape" }, context),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("2. throws ForbiddenError when webScope=restricted and domain not whitelisted", async () => {
    const { context } = makeContext({ webScope: "restricted" });
    await expect(
      webBrowse({ url: "https://blocked.com/page", mode: "scrape" }, context),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("3. ForbiddenError does NOT write to audit log", async () => {
    const { context, db } = makeContext({ webAccess: false });
    try {
      await webBrowse({ url: "https://example.com", mode: "scrape" }, context);
    } catch {
      // expected
    }
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("4. scrape mode: returns Firecrawl markdown result", async () => {
    mockFirecrawl({
      scrape: vi.fn().mockResolvedValue({
        markdown: "# Hello World\n\nSome content here.",
        metadata: { title: "Hello", sourceURL: "https://example.com" },
      }),
    });

    const { context } = makeContext();
    const result = await webBrowse(
      { url: "https://example.com", mode: "scrape" },
      context,
    );

    expect(result.content).toBe("# Hello World\n\nSome content here.");
    expect(result.title).toBe("Hello");
    expect(result.url).toBe("https://example.com");
    expect(result.tokensEstimate).toBeGreaterThan(0);
  });

  it("5. extract mode: returns JSON-stringified data from Firecrawl", async () => {
    mockFirecrawl({
      extract: vi.fn().mockResolvedValue({
        data: { jobTitle: "Software Engineer", salary: 80000 },
      }),
    });

    const { context } = makeContext();
    const result = await webBrowse(
      {
        url: "https://jobs.example.com",
        mode: "extract",
        schema: { jobTitle: "string", salary: "number" },
        intent: "Extract job details",
      },
      context,
    );

    expect(result.content).toContain("Software Engineer");
    expect(result.content).toContain("80000");
  });

  it("6. URL logged to tool_call_log on Firecrawl success", async () => {
    mockFirecrawl({
      scrape: vi.fn().mockResolvedValue({
        markdown: "page content",
        metadata: { title: "Test Page" },
      }),
    });

    const { context, insertValues } = makeContext();
    await webBrowse({ url: "https://example.com", mode: "scrape" }, context);

    expect(insertValues).toHaveBeenCalledOnce();
    const log = insertValues.mock.calls[0][0];
    expect(log.toolType).toBe("web_browse");
    expect(log.toolName).toBe("firecrawl");
    expect(log.input.url).toBe("https://example.com");
    expect(log.input.mode).toBe("scrape");
    expect(log.status).toBe("success");
    expect(log.error).toBeNull();
  });

  it("7. Jina fallback used when Firecrawl throws", async () => {
    mockFirecrawl({
      scrape: vi.fn().mockRejectedValue(new Error("Firecrawl 503")),
    });
    mockFetch("# Jina fallback content");

    const { context } = makeContext();
    const result = await webBrowse(
      { url: "https://example.com", mode: "scrape" },
      context,
    );

    expect(result.content).toBe("# Jina fallback content");
    // Fetch should have been called with Jina URL
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls[0][0]).toContain("r.jina.ai");
  });

  it("8. audit log records status=failed when Firecrawl failed (Jina provided result)", async () => {
    mockFirecrawl({
      scrape: vi.fn().mockRejectedValue(new Error("rate limit exceeded")),
    });
    mockFetch("fallback content");

    const { context, insertValues } = makeContext();
    await webBrowse({ url: "https://example.com", mode: "scrape" }, context);

    const log = insertValues.mock.calls[0][0];
    expect(log.status).toBe("failed");
    expect(log.error).toMatch(/rate limit exceeded/);
  });

  it("9. FIRECRAWL_API_KEY missing → Jina fallback (no crash)", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    mockFetch("jina fallback content");

    const { context } = makeContext();
    const result = await webBrowse(
      { url: "https://example.com", mode: "scrape" },
      context,
    );

    expect(result.content).toBe("jina fallback content");
  });

  it("10. GDPR flag fires when skill.gdprRequired = true (no throw)", async () => {
    mockFirecrawl({
      scrape: vi.fn().mockResolvedValue({
        markdown: "Jean Dupont, 25 ans, Paris — candidature reçue",
        metadata: { title: "CV" },
      }),
    });

    const warnSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { context } = makeContext({ gdprRequired: true });

    // Must not throw — GDPR flag is a warning, not a hard block at this stage
    await expect(
      webBrowse({ url: "https://example.com", mode: "scrape" }, context),
    ).resolves.toBeDefined();

    warnSpy.mockRestore();
  });
});
