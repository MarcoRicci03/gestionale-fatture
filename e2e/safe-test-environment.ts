// e2e/global-setup.ts crea/abilita un utente con password nota e versionata
// (e2e/fixtures/test-user.ts) sul database indicato da DATABASE_URL,
// qualunque esso sia. Un `npm run test:e2e` lanciato per errore con
// l'ambiente di produzione caricato creerebbe quell'account funzionante sul
// database reale (SEC-10). Funzione pura e parametrizzata (non legge
// process.env direttamente) per essere testabile senza dover manipolare lo
// stato globale del processo.
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1"]);

export type TestEnvironment = {
  NODE_ENV?: string;
  DATABASE_URL?: string;
};

export function assertSafeTestEnvironment(env: TestEnvironment): void {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "globalSetup e2e rifiutato: NODE_ENV=production. Creerebbe/abiliterebbe " +
        "l'utente e2e_test (password nota, versionata in e2e/fixtures/test-user.ts) " +
        "sul database di produzione."
    );
  }

  if (!env.DATABASE_URL) {
    throw new Error("globalSetup e2e rifiutato: DATABASE_URL non configurato.");
  }

  let hostname: string;
  try {
    hostname = new URL(env.DATABASE_URL).hostname;
  } catch {
    throw new Error(
      `globalSetup e2e rifiutato: DATABASE_URL non è una URL valida ("${env.DATABASE_URL}").`
    );
  }

  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new Error(
      `globalSetup e2e rifiutato: l'host di DATABASE_URL ("${hostname}") non è ` +
        "localhost/127.0.0.1. Creerebbe/abiliterebbe l'utente e2e_test (password " +
        "nota, versionata) su un database che potrebbe essere reale."
    );
  }
}
