import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Run each test file in its own worker process to prevent vi.mock() module
    // cache pollution between test files that use dynamic await import().
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
