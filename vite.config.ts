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
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
});
