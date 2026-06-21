import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["fixtures/**"],
  },
  lint: {},
  // Tests run on the platform runner (`node --test`), in keeping with v9's built-ins-first
  // philosophy; vite-plus stays for what it's great at — formatting and linting.
});
