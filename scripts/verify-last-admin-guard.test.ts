import { it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Senza questa guardia, nulla impediva a due admin di neutralizzarsi a
// vicenda (o a una race condition tra due richieste concorrenti) di portare
// il sistema a zero admin abilitati: /users e /audit-log diventano
// irraggiungibili (requireAdmin fa redirect a /dashboard) senza alcun
// percorso applicativo di recupero, solo un UPDATE a mano su Postgres.
// Analisi statica (stesso approccio di verify-invoice-lifecycle.test.ts):
// le Server Action chiamano requireAdmin()/prisma, non eseguibili in un
// test Vitest puro senza un contesto di richiesta reale.

const USERS_ACTIONS_PATH = join(__dirname, "..", "lib", "actions", "users.ts");

function extractFunctionBody(source: string, fnName: string): string {
  const fnRegex = new RegExp(`export\\s+async\\s+function\\s+${fnName}\\s*\\(`);
  const match = fnRegex.exec(source);
  if (!match) {
    throw new Error(`Funzione ${fnName} non trovata in ${USERS_ACTIONS_PATH}`);
  }
  const openBrace = source.indexOf("{", match.index);
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(openBrace, i + 1);
    }
  }
  throw new Error(`Corpo di ${fnName} non terminato correttamente`);
}

const source = readFileSync(USERS_ACTIONS_PATH, "utf-8");

it("updateUser conta gli admin abilitati rimanenti prima di rimuovere isAdmin/abilitato", () => {
  const body = extractFunctionBody(source, "updateUser");
  expect(body).toMatch(/!isAdmin\s*\|\|\s*!abilitato/);
  expect(body).toMatch(
    /utente\.count\(\s*\{\s*where:\s*\{\s*isAdmin:\s*true,\s*abilitato:\s*true,\s*NOT:\s*\{\s*id\s*\}/
  );
});

it("toggleUserEnabled conta gli admin abilitati rimanenti prima di disabilitare", () => {
  const body = extractFunctionBody(source, "toggleUserEnabled");
  expect(body).toMatch(/if\s*\(\s*!abilitato\s*\)/);
  expect(body).toMatch(
    /utente\.count\(\s*\{\s*where:\s*\{\s*isAdmin:\s*true,\s*abilitato:\s*true,\s*NOT:\s*\{\s*id\s*\}/
  );
});

it("entrambe le guardie bloccano quando adminAttivi === 0", () => {
  for (const fn of ["updateUser", "toggleUserEnabled"]) {
    const body = extractFunctionBody(source, fn);
    expect(body).toMatch(/adminAttivi\s*===\s*0/);
    expect(body).toMatch(/Deve restare almeno un amministratore abilitato/);
  }
});
