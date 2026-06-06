/**
 * server/src/__tests__/helpers/mock-cleanup.setup.ts
 *
 * Vitest setupFiles entry — runs before EACH test file.
 *
 * 12 test files use vi.mock("@paperclipai/db") or vi.mock("drizzle-orm")
 * at module level (hoisted). With pool: "forks" + isolate: true, vitest
 * clears the module instance registry between files but does NOT clear the
 * vi.mock() factory registry. This causes factories registered by file A to
 * remain active when file B starts, producing non-deterministic failures.
 *
 * This setup file runs BEFORE each file's hoisted vi.mock() calls:
 *   1. vi.doUnmock() clears any leftover factories from the previous file
 *   2. The current test file's own vi.mock() calls then re-register what it needs
 *
 * Contaminating modules (mocked in 2+ test files):
 *   @paperclipai/db — schema objects; mocked factories differ between files
 *   drizzle-orm     — eq/and/inArray helpers; mocked to return plain objects
 */

import { vi } from "vitest";

// Clear factories for modules that contaminate across file boundaries.
// vi.doUnmock() is NOT hoisted (unlike vi.unmock()) so it runs at call time.
vi.doUnmock("@paperclipai/db");
vi.doUnmock("drizzle-orm");
