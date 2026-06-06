import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Run each test file in its own fork process to prevent vi.mock() module
    // cache pollution between test files that use dynamic await import().
    // Note: 2-3 tests still fail non-deterministically in the full suite due
    // to base Paperclip test infrastructure issues (shared singletons in mock
    // factories). All tests pass individually. This is a known limitation of
    // the base test suite and not introduced by Swwarm.
    pool: "forks",
    poolOptions: {
      forks: {
        // Cap concurrency to reduce embedded-postgres / temp-dir contention
        // between parallel test files in the full suite.
        maxForks: 4,
      },
    },
  },
});
