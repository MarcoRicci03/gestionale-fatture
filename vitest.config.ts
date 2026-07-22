import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
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
    exclude: ["**/e2e/**", "**/node_modules/**", "**/.next/**", "**/.claude/**"],
  },
});
