import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // lib/data/* importa "server-only": vedi vitest.server-only-stub.ts.
    alias: {
      "server-only": fileURLToPath(new URL("./vitest.server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Playwright ha il proprio runner: Vitest non deve raccogliere gli spec E2E.
    // Pattern ancorati con "**/" (non impliciti): senza, "exclude" qui sotto
    // sovrascrive i default di Vitest e non filtra i node_modules annidati
    // (es. dentro eventuali worktree in .claude/worktrees/**).
    include: ["**/*.{test,spec}.{ts,tsx}"],
    // scripts/db-integration/**: test di integrazione contro un Postgres
    // reale (QUA-04, vedi vitest.integration.config.ts / `npm run test:db`),
    // non disponibile in CI/qui — vanno esclusi da questa suite.
    exclude: [
      "**/e2e/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/.claude/**",
      "**/scripts/db-integration/**",
    ],
  },
});
