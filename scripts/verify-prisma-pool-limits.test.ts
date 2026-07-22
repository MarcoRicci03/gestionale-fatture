import { it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regressione SEC-14: `new Pool({ connectionString })` senza `max` non
// impedisce di aprire connessioni fino a saturare `max_connections` lato
// Postgres sotto carico o leak di connessioni; senza `idleTimeoutMillis`/
// `connectionTimeoutMillis` una connessione inattiva o un DB irraggiungibile
// possono bloccare il pool a tempo indeterminato. lib/prisma.ts deve passare
// limiti espliciti al Pool di `pg`.
//
// DATABASE_URL va impostato PRIMA di importare lib/prisma.ts (che lo legge e
// costruisce il Pool al caricamento del modulo): import dinamico in
// beforeAll, dopo aver valorizzato process.env.DATABASE_URL con una stringa
// di connessione sintatticamente valida ma non realmente raggiungibile —
// `new Pool(...)` non si connette finché non viene eseguita una query, quindi
// è sicuro importare il modulo senza un vero Postgres in ascolto.

beforeAll(async () => {
  process.env.DATABASE_URL ??=
    "postgresql://verify:verify@localhost:5432/verify-script-only";
  // Costruisce il Pool applicativo reale e verifica che il solo caricamento
  // del modulo non lanci (nessuna connessione eager).
  await import("../lib/prisma");
});

it("il Pool di pg ha limiti espliciti (max/idleTimeoutMillis/connectionTimeoutMillis)", () => {
  const source = readFileSync(join(__dirname, "..", "lib", "prisma.ts"), "utf-8");

  const checks: Array<[RegExp, string]> = [
    [/max\s*:\s*\d+/, "un `max` numerico esplicito sul Pool"],
    [
      /idleTimeoutMillis\s*:\s*\d[\d_]*/,
      "un `idleTimeoutMillis` numerico esplicito sul Pool",
    ],
    [
      /connectionTimeoutMillis\s*:\s*\d[\d_]*/,
      "un `connectionTimeoutMillis` numerico esplicito sul Pool",
    ],
  ];
  for (const [pattern, description] of checks) {
    expect(pattern.test(source), `lib/prisma.ts non imposta più ${description}`).toBe(true);
  }
});
