import { defineConfig } from "vitest/config";

// Config separata per i test di integrazione DB (QUA-04): a differenza di
// vitest.config.ts (npm test), questi test aprono connessioni reali verso
// Postgres (database gestionale_test, creato/distrutto da global-setup.ts) e
// non devono girare come parte di `npm test`/CI, dove nessun Postgres è
// disponibile. Eseguiti con `npm run test:db`, che richiede
// `docker compose -f docker-compose.dev.yml up -d` avviato.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["scripts/db-integration/**/*.test.ts"],
    setupFiles: ["./scripts/db-integration/setup-env.ts"],
    globalSetup: ["./scripts/db-integration/global-setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Le fatture di uno stesso Utente di test condividono la numerazione
    // (n_fattura, anno) tra i vari file: file diversi eseguiti in parallelo
    // su thread/processi diversi rischierebbero race condition spurie.
    fileParallelism: false,
  },
});
