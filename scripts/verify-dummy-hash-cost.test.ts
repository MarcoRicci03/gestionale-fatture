import { it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Regressione SEC-05: in lib/actions/auth.ts, login() confronta la password
// inserita contro DUMMY_HASH quando lo username non esiste (o è disabilitato),
// per impedire che il tempo di risposta riveli se un dato username è
// registrato. Questo funziona SOLO se DUMMY_HASH ha lo stesso cost factor
// bcrypt usato da hashPassword() per gli hash reali (lib/auth/password.ts):
// un cost diverso rende il confronto misurabilmente più lento/veloce, e quindi
// distinguibile via timing, esattamente il problema che DUMMY_HASH dovrebbe
// risolvere. Verificato via analisi statica (non timing, intrinsecamente
// rumoroso) confrontando i due cost factor nel sorgente.
const PASSWORD_PATH = join(__dirname, "..", "lib", "auth", "password.ts");
const AUTH_ACTION_PATH = join(__dirname, "..", "lib", "actions", "auth.ts");

function extractRealBcryptCost(): number {
  const source = readFileSync(PASSWORD_PATH, "utf-8");
  const match = source.match(/hash\(\s*plainPassword\s*,\s*(\d+)\s*\)/);
  if (!match) {
    throw new Error(
      `Impossibile individuare il cost factor di hash() in ${PASSWORD_PATH}`
    );
  }
  return Number(match[1]);
}

function extractDummyHashCost(): number {
  const source = readFileSync(AUTH_ACTION_PATH, "utf-8");
  const dummyHashMatch = source.match(/const DUMMY_HASH = "([^"]+)"/);
  if (!dummyHashMatch) {
    throw new Error(`Impossibile individuare DUMMY_HASH in ${AUTH_ACTION_PATH}`);
  }
  const bcryptFormatMatch = dummyHashMatch[1].match(/^\$2[aby]?\$(\d{2})\$/);
  if (!bcryptFormatMatch) {
    throw new Error(
      `DUMMY_HASH non ha il formato di un hash bcrypt valido: ${dummyHashMatch[1]}`
    );
  }
  return Number(bcryptFormatMatch[1]);
}

it("DUMMY_HASH usa lo stesso cost factor bcrypt degli hash reali", () => {
  const realCost = extractRealBcryptCost();
  const dummyCost = extractDummyHashCost();

  expect(
    dummyCost,
    `DUMMY_HASH ha cost factor ${dummyCost}, ma hashPassword() usa cost factor ${realCost}: ` +
      "il tempo di verifica per uno username inesistente sarebbe distinguibile da quello di " +
      "uno username esistente (enumerazione via timing). Rigenera DUMMY_HASH con lo stesso " +
      `cost factor (${realCost}), es. con bcryptjs.hash("qualsiasi-stringa", ${realCost}).`
  ).toBe(realCost);
});
