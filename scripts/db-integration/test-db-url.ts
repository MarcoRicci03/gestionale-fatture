// Funzione pura condivisa tra global-setup.ts (crea/distrugge il database)
// e setup-env.ts (punta process.env.DATABASE_URL alla stessa URL in ogni
// worker Vitest): un'unica fonte di verità per il nome del database di test,
// così i due file non possono mai finire a puntare a database diversi.

export const TEST_DB_NAME = "gestionale_test";

export function withDatabaseName(databaseUrl: string, dbName: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}
