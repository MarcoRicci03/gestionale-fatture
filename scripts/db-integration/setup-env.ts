import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { assertSafeTestEnvironment } from "../../e2e/safe-test-environment";
import { TEST_DB_NAME, withDatabaseName } from "./test-db-url";

// setupFiles (a differenza di globalSetup) gira dentro lo stesso worker che
// esegue i test file, PRIMA che questi importino qualunque modulo: è quindi
// il punto giusto per riscrivere process.env.DATABASE_URL verso
// gestionale_test prima che `@/lib/prisma` (importato da ogni action/data
// layer sotto test) legga quella variabile e apra il pool di connessioni.
// Non dipende dal fatto che global-setup.ts (eseguito una volta, in un
// processo separato) riesca a propagare le proprie modifiche a process.env
// ai worker: questo file ricalcola la stessa URL in autonomia, con la stessa
// funzione pura.
loadEnvConfig(path.resolve(__dirname, "..", ".."));
assertSafeTestEnvironment(process.env);

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = withDatabaseName(process.env.DATABASE_URL, TEST_DB_NAME);
}
