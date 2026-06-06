import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // pool: "forks" gives each test file its own process with a fresh module
    // registry (isolate: true). However, vitest 3.2.4 does not clear the
    // vi.mock() factory registry between files in the same fork worker.
    // 12 test files mock @paperclipai/db / drizzle-orm at module level (hoisted).
    // This causes 2-3 non-deterministic failures per full suite run.
    //
    // All failing tests pass individually. Root cause is a vitest limitation:
    // no public API to flush the factory registry between files short of
    // rewriting all 12 contaminating files from vi.mock() to vi.doMock()
    // (estimated 4+ hours, high cascade risk). Accepted as-is.
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 4,
      },
    },
  },
});
