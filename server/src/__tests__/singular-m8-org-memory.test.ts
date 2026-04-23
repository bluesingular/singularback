/**
 * M8 — Org memory (pgvector) + Contact entity foundation
 *
 * Tests:
 *  1. embedText: calls OpenRouter Mistral Embed, returns 1024-dim vector
 *  2. embedText: throws EmbedError when OPENROUTER_API_KEY is missing
 *  3. embedText: throws EmbedError when API returns wrong dimension count
 *  4. storeMemory: generates embedding and writes DB row with embedding
 *  5. searchMemory: entry with similarity 0.85 (> 0.72) → returned
 *  6. searchMemory: entry with similarity 0.60 (≤ 0.72) → filtered out
 *  7. searchMemory: archived entries excluded (db returns empty)
 *  8. searchMemory: maxChunks respected — returns at most N entries
 *  9. searchMemory: token budget stops adding chunks before exceeding limit
 * 10. buildContactProfile: returns formatted profile (contact + events + notes)
 * 11. buildContactProfile: unknown contact → returns empty string
 * 12. injectContactProfile: name found in query → returns profile
 * 13. injectContactProfile: no name match → returns null
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ── Mock embedText before any imports that depend on it ───────────────────────

vi.mock("../memory/embed.js", () => ({
  embedText: vi.fn(),
  EmbedError: class EmbedError extends Error {
    constructor(msg: string) { super(msg); this.name = "EmbedError"; }
  },
}));

import { embedText, EmbedError } from "../memory/embed.js";
import {
  storeMemory,
  searchMemory,
  buildContactProfile,
  injectContactProfile,
  SIMILARITY_THRESHOLD,
} from "../memory/service.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_VECTOR = new Array(1024).fill(0.1);

/** DB mock for storeMemory — one insert */
function makeStoreDb() {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  return {
    db: { insert: vi.fn().mockReturnValue({ values: insertValues }) } as any,
    insertValues,
  };
}

/** DB mock for searchMemory — execute returns raw rows */
function makeSearchDb(rows: object[]) {
  return {
    db: { execute: vi.fn().mockResolvedValue(rows) } as any,
  };
}

/** DB mock for buildContactProfile */
function makeContactDb(opts: {
  contact?: object | null;
  events?: object[];
  notes?: object[];
}) {
  let callCount = 0;
  const contact    = opts.contact  ?? null;
  const events     = opts.events   ?? [];
  const notes      = opts.notes    ?? [];

  const limit = vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) return Promise.resolve(contact ? [contact] : []);
    return Promise.resolve([]);
  });

  const orderByAndLimit = vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 2) return Promise.resolve(events);
    return Promise.resolve(notes);
  });

  // contacts query: select().from().where().limit()
  // events/notes queries: select().from().where().orderBy().limit()
  const where = vi.fn().mockReturnValue({ limit, orderBy: vi.fn().mockReturnValue({ limit: orderByAndLimit }) });
  const from  = vi.fn().mockReturnThis();

  const db = {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) }),
  } as any;

  return { db };
}

// ── embedText tests ───────────────────────────────────────────────────────────

describe("embedText", () => {
  const ORIG_KEY = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = "or-test-key";
  });

  afterEach(() => {
    if (ORIG_KEY === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = ORIG_KEY;
    vi.unstubAllGlobals();
  });

  it("1. calls OpenRouter and returns 1024-dim vector", async () => {
    // Use the actual (unmocked) embedText implementation for this test
    const { embedText: realEmbed } = await vi.importActual<typeof import("../memory/embed.js")>(
      "../memory/embed.js",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: FAKE_VECTOR }] }),
      }),
    );

    const result = await realEmbed("test text");

    expect(result).toHaveLength(1024);
    expect(result[0]).toBe(0.1);

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain("openrouter.ai");
    const body = JSON.parse(fetchCall[1].body);
    expect(body.model).toBe("mistralai/mistral-embed");
    expect(body.input).toBe("test text");
  });

  it("2. throws EmbedError when OPENROUTER_API_KEY is missing", async () => {
    const { embedText: realEmbed, EmbedError: RealEmbedError } =
      await vi.importActual<typeof import("../memory/embed.js")>("../memory/embed.js");

    delete process.env.OPENROUTER_API_KEY;
    await expect(realEmbed("hello")).rejects.toBeInstanceOf(RealEmbedError);
  });

  it("3. throws EmbedError when API returns wrong dimension count", async () => {
    const { embedText: realEmbed, EmbedError: RealEmbedError } =
      await vi.importActual<typeof import("../memory/embed.js")>("../memory/embed.js");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
      }),
    );

    await expect(realEmbed("hello")).rejects.toBeInstanceOf(RealEmbedError);
  });
});

// ── storeMemory tests ─────────────────────────────────────────────────────────

describe("storeMemory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("4. generates embedding and writes DB row with embedding column", async () => {
    vi.mocked(embedText).mockResolvedValue(FAKE_VECTOR);
    const { db, insertValues } = makeStoreDb();

    await storeMemory(db, {
      companyId:  "company-1",
      agentId:    "agent-1",
      title:      "Candidate Jean Dupont",
      content:    "Strong TypeScript skills, 5 years experience",
      importance: 4,
    });

    expect(embedText).toHaveBeenCalledOnce();
    expect(insertValues).toHaveBeenCalledOnce();

    const row = insertValues.mock.calls[0][0];
    expect(row.embedding).toEqual(FAKE_VECTOR);
    expect(row.importance).toBe(4);
    expect(row.title).toBe("Candidate Jean Dupont");
  });
});

// ── searchMemory tests ────────────────────────────────────────────────────────

describe("searchMemory", () => {
  beforeEach(() => vi.clearAllMocks());

  const baseParams = {
    companyId: "company-1",
    query:     "TypeScript developer with React experience",
    maxChunks: 5,
    maxTokens: 2000,
  };

  it("5. entry with similarity 0.85 (> 0.72 threshold) → returned", async () => {
    vi.mocked(embedText).mockResolvedValue(FAKE_VECTOR);
    const { db } = makeSearchDb([
      { id: "m1", title: "Senior dev profile", content: "Jean Dupont, TS expert", importance: 3, similarity: 0.85 },
    ]);

    const result = await searchMemory(db, baseParams);
    expect(result.chunksUsed).toBe(1);
    expect(result.text).toContain("Jean Dupont");
  });

  it("6. entry with similarity 0.60 (≤ 0.72 threshold) → filtered out", async () => {
    vi.mocked(embedText).mockResolvedValue(FAKE_VECTOR);
    const { db } = makeSearchDb([
      { id: "m1", title: "Vague profile", content: "Some candidate info", importance: 2, similarity: 0.60 },
    ]);

    const result = await searchMemory(db, baseParams);
    expect(result.chunksUsed).toBe(0);
    expect(result.text).toBe("");
  });

  it("7. archived entries excluded — db returns empty (WHERE archived=false in SQL)", async () => {
    vi.mocked(embedText).mockResolvedValue(FAKE_VECTOR);
    // DB returns nothing (archived filter applied in SQL)
    const { db } = makeSearchDb([]);

    const result = await searchMemory(db, baseParams);
    expect(result.chunksUsed).toBe(0);
  });

  it("8. maxChunks respected — returns at most N entries", async () => {
    vi.mocked(embedText).mockResolvedValue(FAKE_VECTOR);
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`, title: `Memory ${i}`, content: `Content ${i}`, importance: 3, similarity: 0.9,
    }));
    const { db } = makeSearchDb(rows);

    const result = await searchMemory(db, { ...baseParams, maxChunks: 3 });
    expect(result.chunksUsed).toBe(3);
  });

  it("9. token budget stops adding chunks before exceeding limit", async () => {
    vi.mocked(embedText).mockResolvedValue(FAKE_VECTOR);
    // Each chunk content is ~40 words ≈ 50 tokens; budget of 80 allows only 1
    const longContent = "word ".repeat(40).trim();
    const rows = [
      { id: "m1", title: "Chunk 1", content: longContent, importance: 3, similarity: 0.88 },
      { id: "m2", title: "Chunk 2", content: longContent, importance: 3, similarity: 0.87 },
    ];
    const { db } = makeSearchDb(rows);

    const result = await searchMemory(db, { ...baseParams, maxTokens: 80 });
    expect(result.chunksUsed).toBeLessThan(2);
  });
});

// ── buildContactProfile tests ─────────────────────────────────────────────────

describe("buildContactProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("10. returns formatted profile (contact + events + notes)", async () => {
    const contact = {
      id:           "c1",
      fullName:     "Marie Martin",
      email:        "marie@agence.fr",
      role:         "Consultante RH",
      organisation: "Agence Talent",
      notes:        "Spécialiste recrutement IT",
    };
    const events = [
      { eventType: "email_sent", summary: "Envoi offre d'emploi React", occurredAt: new Date("2026-03-10") },
    ];
    const notes = [
      { content: "Très réactive, préfère contact le matin" },
    ];

    // Build a more complete mock for this test
    let callCount = 0;
    const mockLimit = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([contact]);
      return Promise.resolve([]);
    });
    const mockOrderByLimit = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) return Promise.resolve(events);
      return Promise.resolve(notes);
    });
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockOrderByLimit });
    const mockWhere   = vi.fn().mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy });
    const mockFrom    = vi.fn().mockReturnValue({ where: mockWhere });
    const db = { select: vi.fn().mockReturnValue({ from: mockFrom }) } as any;

    const profile = await buildContactProfile(db, "company-1", "Marie Martin");

    expect(profile).toContain("Marie Martin");
    expect(profile).toContain("Consultante RH");
    expect(profile).toContain("marie@agence.fr");
    expect(profile).toContain("email_sent");
    expect(profile).toContain("Très réactive");
  });

  it("11. unknown contact → returns empty string", async () => {
    let callCount = 0;
    const mockLimit = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve([]); // no contact found
    });
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit, orderBy: vi.fn() });
    const mockFrom  = vi.fn().mockReturnValue({ where: mockWhere });
    const db = { select: vi.fn().mockReturnValue({ from: mockFrom }) } as any;

    const profile = await buildContactProfile(db, "company-1", "Inconnu Fictif");
    expect(profile).toBe("");
  });
});

// ── injectContactProfile tests ────────────────────────────────────────────────

describe("injectContactProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("12. name found in query → returns non-null profile", async () => {
    const contact = {
      id: "c1", fullName: "Jean Dupont", email: "jean@example.fr",
      role: "Développeur", organisation: null, notes: null,
    };

    let callCount = 0;
    const mockLimit = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([contact]);
      return Promise.resolve([]);
    });
    const mockOrderByLimit = vi.fn().mockResolvedValue([]);
    const mockOrderBy      = vi.fn().mockReturnValue({ limit: mockOrderByLimit });
    const mockWhere        = vi.fn().mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy });
    const mockFrom         = vi.fn().mockReturnValue({ where: mockWhere });
    const db = { select: vi.fn().mockReturnValue({ from: mockFrom }) } as any;

    const result = await injectContactProfile(
      db,
      "company-1",
      "Préparer un email de suivi pour Jean Dupont suite à l'entretien",
    );

    expect(result).not.toBeNull();
    expect(result).toContain("Jean Dupont");
  });

  it("13. no name match in contacts → returns null", async () => {
    const mockLimit = vi.fn().mockResolvedValue([]); // no contact found
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit, orderBy: vi.fn() });
    const mockFrom  = vi.fn().mockReturnValue({ where: mockWhere });
    const db = { select: vi.fn().mockReturnValue({ from: mockFrom }) } as any;

    const result = await injectContactProfile(
      db,
      "company-1",
      "Envoyer le rapport hebdomadaire aux clients",
    );

    expect(result).toBeNull();
  });
});

// ── Constant check ────────────────────────────────────────────────────────────

describe("SIMILARITY_THRESHOLD", () => {
  it("is 0.72 per spec", () => {
    expect(SIMILARITY_THRESHOLD).toBe(0.72);
  });
});
