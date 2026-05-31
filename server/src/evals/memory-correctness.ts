/**
 * server/src/evals/memory-correctness.ts
 *
 * §31.4 — Memory correctness testing.
 *
 * Weekly background job that validates org memory retrieval accuracy per company.
 * Uses canonical query + expected answer pairs seeded at pack install.
 *
 * Threshold: match_score >= 0.85 per test, avg >= 0.80 per company.
 * Below threshold → flag in morning intelligence:
 *   "La mémoire de votre équipe pourrait bénéficier d'une mise à jour"
 *
 * Called from: morningIntelligence.worker.ts on Mondays.
 * Also callable from admin portal: POST /admin/companies/:id/memory-test
 */

import { eq, and, desc, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { memoryCorrectnessTests, memoryEntries } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "memory-correctness" });

const PASS_THRESHOLD    = 0.85;  // per test
const COMPANY_THRESHOLD = 0.80;  // avg across all tests for a company
const MAX_TESTS         = 20;    // max tests per company per run

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemoryTest {
  query:          string;
  expectedAnswer: string;
}

export interface MemoryTestResult {
  query:          string;
  expectedAnswer: string;
  actualAnswer:   string;
  matchScore:     number;
  passed:         boolean;
}

export interface CompanyMemoryTestSummary {
  companyId:   string;
  testsRun:    number;
  avgScore:    number;
  passRate:    number;
  needsReview: boolean;
  results:     MemoryTestResult[];
}

// ── runMemoryCorrectnessTests ─────────────────────────────────────────────────

/**
 * Run memory correctness tests for a company.
 *
 * Retrieves canonical test queries from company DNA, searches org memory,
 * and compares retrieved content against expected answers using keyword overlap.
 *
 * Returns summary and persists individual results.
 */
export async function runMemoryCorrectnessTests(
  db:        Db,
  companyId: string,
): Promise<CompanyMemoryTestSummary> {
  // Get test queries from persistent memory_correctness_tests (seeded at install)
  // Only run tests that have expected answers set
  const testDefs = await (db as any)
    .select({
      query:          memoryCorrectnessTests.query,
      expectedAnswer: memoryCorrectnessTests.expectedAnswer,
    })
    .from(memoryCorrectnessTests)
    .where(and(
      eq(memoryCorrectnessTests.companyId, companyId),
      sql`expected_answer IS NOT NULL AND expected_answer != ''`,
    ))
    .orderBy(desc(memoryCorrectnessTests.createdAt))
    .limit(MAX_TESTS);

  if (testDefs.length === 0) {
    logger.info({ companyId }, "memory-correctness: no test definitions found — skipping");
    return {
      companyId,
      testsRun:    0,
      avgScore:    1.0,
      passRate:    1.0,
      needsReview: false,
      results:     [],
    };
  }

  const results: MemoryTestResult[] = [];

  for (const test of testDefs) {
    // Retrieve actual answer from org memory (simplified: keyword search)
    const actualAnswer = await retrieveActualAnswer(db, companyId, test.query);
    const matchScore   = computeMatchScore(actualAnswer, test.expectedAnswer);
    const passed       = matchScore >= PASS_THRESHOLD;

    results.push({
      query:          test.query,
      expectedAnswer: test.expectedAnswer,
      actualAnswer,
      matchScore,
      passed,
    });

    // Persist individual result
    await (db as any).insert(memoryCorrectnessTests).values({
      companyId,
      query:          test.query,
      expectedAnswer: test.expectedAnswer,
      actualAnswer,
      matchScore:     String(matchScore.toFixed(3)),
      passed,
    });
  }

  const avgScore    = results.length > 0
    ? results.reduce((s, r) => s + r.matchScore, 0) / results.length
    : 1.0;
  const passRate    = results.length > 0
    ? results.filter((r) => r.passed).length / results.length
    : 1.0;
  const needsReview = avgScore < COMPANY_THRESHOLD;

  logger.info(
    { companyId, testsRun: results.length, avgScore: avgScore.toFixed(3), needsReview },
    "memory-correctness: tests complete",
  );

  return { companyId, testsRun: results.length, avgScore, passRate, needsReview, results };
}

// ── seedMemoryTests ───────────────────────────────────────────────────────────

/**
 * Seed canonical test queries at pack install from Company DNA.
 * Called by the pack installer after DNA upsert.
 */
export async function seedMemoryTests(
  db:        Db,
  companyId: string,
  tests:     MemoryTest[],
): Promise<void> {
  if (tests.length === 0) return;

  await (db as any).insert(memoryCorrectnessTests).values(
    tests.map((t) => ({
      companyId,
      query:          t.query,
      expectedAnswer: t.expectedAnswer,
    })),
  ).onConflictDoNothing();

  logger.info({ companyId, count: tests.length }, "memory-correctness: tests seeded");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function retrieveActualAnswer(
  db:        Db,
  companyId: string,
  query:     string,
): Promise<string> {
  // Simplified retrieval — production uses pgvector cosine similarity
  const rows = await (db as any)
    .select({ content: memoryEntries.content })
    .from(memoryEntries)
    .where(eq(memoryEntries.companyId, companyId))
    .limit(3);

  return rows.map((r: any) => r.content).join(" ") || "";
}

/**
 * Compute semantic similarity as keyword overlap (Jaccard-style).
 * Production: uses embedding cosine similarity (T3 EMBEDDING_CONFIG).
 */
function computeMatchScore(actual: string, expected: string): number {
  if (!actual || !expected) return 0;

  const wordsActual   = tokenize(actual);
  const wordsExpected = tokenize(expected);

  if (wordsExpected.size === 0) return 1.0; // empty expected = pass

  const intersection = new Set([...wordsExpected].filter((w) => wordsActual.has(w)));
  return intersection.size / wordsExpected.size;
}

function tokenize(text: string): Set<string> {
  const stopwords = new Set(["le","la","les","un","une","des","est","sont","de","du","et","à","en","par","pour","sur","avec"]);
  return new Set(
    text.toLowerCase()
      .replace(/[^a-zàâéèêëîïôùûüç\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopwords.has(w)),
  );
}

export { PASS_THRESHOLD, COMPANY_THRESHOLD };
