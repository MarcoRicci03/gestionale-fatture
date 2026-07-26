import { it, expect } from "vitest";
import { assertSafeTestEnvironment } from "../e2e/safe-test-environment";

// e2e/global-setup.ts crea/abilita un utente con password nota e versionata
// (e2e/fixtures/test-user.ts) sul database indicato da DATABASE_URL,
// qualunque esso sia. Un `npm run test:e2e` lanciato per errore con
// l'ambiente di produzione caricato creerebbe quell'account funzionante sul
// database reale (SEC-10). Test comportamentale (non analisi statica): la
// funzione è pura e parametrizzata, quindi eseguibile direttamente in
// Vitest — vitest.config.ts esclude "**/e2e/**" dalla raccolta, per questo
// il test vive qui e non accanto al modulo.

it("rifiuta NODE_ENV=production, anche con DATABASE_URL locale", () => {
  expect(() =>
    assertSafeTestEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    })
  ).toThrow(/production/);
});

it("rifiuta DATABASE_URL assente", () => {
  expect(() =>
    assertSafeTestEnvironment({ NODE_ENV: "test", DATABASE_URL: undefined })
  ).toThrow(/DATABASE_URL non configurato/);
});

it("rifiuta una DATABASE_URL non parsabile come URL", () => {
  expect(() =>
    assertSafeTestEnvironment({ NODE_ENV: "test", DATABASE_URL: "non-una-url" })
  ).toThrow(/non è una URL valida/);
});

it("rifiuta un host remoto (es. un database di produzione)", () => {
  expect(() =>
    assertSafeTestEnvironment({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://user:pass@db.produzione.example.com:5432/gestionale",
    })
  ).toThrow(/non è localhost\/127\.0\.0\.1/);
});

it("accetta localhost", () => {
  expect(() =>
    assertSafeTestEnvironment({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/gestionale",
    })
  ).not.toThrow();
});

it("accetta 127.0.0.1", () => {
  expect(() =>
    assertSafeTestEnvironment({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/gestionale",
    })
  ).not.toThrow();
});

it("accetta NODE_ENV assente (default dello sviluppo locale)", () => {
  expect(() =>
    assertSafeTestEnvironment({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/gestionale",
    })
  ).not.toThrow();
});
