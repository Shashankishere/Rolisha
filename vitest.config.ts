import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Minimal, standalone Vitest config — intentionally does NOT reuse
// vite.config.ts, since that pulls in @lovable.dev/vite-tanstack-config
// (TanStack Start SSR/nitro plugins) which have no place in a unit-test
// runner. Only the `@ -> src` alias from tsconfig.json is replicated here,
// which is all the pure-logic tests in `src/**/__tests__` need.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/jobs/**/*.ts", "src/lib/domain.ts"],
      exclude: ["src/lib/jobs/**/*.test.ts"],
    },
  },
});
