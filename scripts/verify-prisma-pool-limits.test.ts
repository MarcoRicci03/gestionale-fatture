import { it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `new Pool({ connectionString })` senza `max` non
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

// PERF-06: senza questo, ogni valutazione del modulo (ogni hot-reload in
// sviluppo) creava un nuovo Pool che nessuno avrebbe mai usato — il
// PrismaClient cachato su globalThis continua a usare il primo — e
// sovrascriveva globalForPrisma.pool, rendendo quel riferimento inaffidabile
// per chiudere il pool. Analisi statica (stesso approccio del test sopra):
// verifica che `new Pool(` sia raggiunto solo dopo un fallback su
// globalForPrisma.pool, non eseguito incondizionatamente.
it("il Pool viene riusato da globalForPrisma, non ricreato a ogni valutazione del modulo", () => {
  const source = readFileSync(join(__dirname, "..", "lib", "prisma.ts"), "utf-8");
  expect(
    /globalForPrisma\.pool\s*\?\?\s*new Pool\s*\(/.test(source),
    "lib/prisma.ts deve riusare globalForPrisma.pool con `??` invece di eseguire `new Pool(...)` incondizionatamente"
  ).toBe(true);
});

// PERF-06: senza un handler di shutdown, un SIGTERM (docker compose down,
// redeploy) termina il processo lasciando connessioni a Postgres aperte da
// chiudere per timeout lato server.
it("registra un handler di shutdown su SIGTERM/SIGINT che chiude prisma e il pool", () => {
  const source = readFileSync(join(__dirname, "..", "lib", "prisma.ts"), "utf-8");
  expect(source).toMatch(/process\.once\s*\(\s*signal/);
  expect(source).toMatch(/\[\s*"SIGTERM"\s*,\s*"SIGINT"\s*\]/);
  expect(source).toMatch(/prisma\.\$disconnect\s*\(\s*\)/);
  expect(source).toMatch(/pool\.end\s*\(\s*\)/);
});
