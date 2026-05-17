import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["test/fixtures/**", "test/expected/**"],
  },
  lint: {},
  test: {
    globals: true,
    testTimeout: 100_000,
    pool: "threads",
    projects: [
      {
        extends: true,
        test: {
          include: ["test/*.test.js"],
          exclude: ["test/cli.test.js"],
          name: "unit",
          pool: "threads",
        },
      },
      {
        extends: true,
        test: {
          include: ["test/cli.test.js"],
          name: "cli",
          pool: "forks",
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
});
