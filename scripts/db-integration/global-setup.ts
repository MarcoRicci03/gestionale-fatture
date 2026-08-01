import path from "node:path";
import { execSync } from "node:child_process";
import { Client } from "pg";
import { loadEnvConfig } from "@next/env";
import { assertSafeTestEnvironment } from "../../e2e/safe-test-environment";
import { TEST_DB_NAME, withDatabaseName } from "./test-db-url";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

// Eseguito una sola volta, prima di ogni worker Vitest (vedi
// vitest.integration.config.ts): crea da zero il database gestionale_test
// (drop + create, per partire sempre da uno stato pulito anche dopo un run
// precedente interrotto) e vi applica tutte le migration reali con `prisma
// migrate deploy` — a differenza di `db push`, questo applica anche l'SQL
// scritto a mano per gli indici unique parziali su paganti(cf)/paganti(piva)
// (vedi il commento sul model Pagante in schema.prisma), che sono
// esattamente ciò che scripts/db-integration/payers-constraints.test.ts
// verifica. setup-env.ts (setupFiles, eseguito dentro ogni worker) punta poi
// process.env.DATABASE_URL allo stesso database, ricalcolando
// indipendentemente la stessa URL con la stessa funzione pura — questo
// evita di dover contare su una propagazione di process.env da qui ai
// worker, che Vitest non garantisce esplicitamente.
export default async function setup() {
  loadEnvConfig(REPO_ROOT);
  assertSafeTestEnvironment(process.env);

  const baseUrl = process.env.DATABASE_URL!;
  const testDatabaseUrl = withDatabaseName(baseUrl, TEST_DB_NAME);
  // "postgres" è il database di manutenzione presente su ogni installazione
  // Postgres, usato solo per poter eseguire DROP/CREATE DATABASE su
  // gestionale_test (non ci si può connettere al database bersaglio per
  // cancellarlo).
  const maintenanceUrl = withDatabaseName(baseUrl, "postgres");

  const admin = new Client({ connectionString: maintenanceUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } finally {
    await admin.end();
  }

  // execSync (shell: true implicito) invece di execFileSync: su Windows
  // "npx" risolve a "npx.cmd", che execFileSync non trova senza una shell
  // (PATHEXT non viene applicato). Comando fisso, nessun input esterno
  // interpolato: nessun rischio di command injection.
  execSync("npx prisma migrate deploy", {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });

  return async function teardown() {
    const cleanup = new Client({ connectionString: maintenanceUrl });
    await cleanup.connect();
    try {
      await cleanup.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    } finally {
      await cleanup.end();
    }
  };
}
