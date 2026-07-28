import { it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Regressione per LOG-09: `getArchivedPayers` (lib/data/payers.ts) calcola
// `pazientiArchiviati`, il conteggio mostrato da RestorePayerButton nella
// dialog di conferma ("Verranno ripristinati anche N pazienti collegati").
// Dopo il fix di LOG-09, restorePayer ripristina SOLO i pazienti archiviati
// in cascata (archiviatoInCascata: true) — se questo conteggio continuasse a
// includere anche i pazienti archiviati manualmente, la dialog
// prometterebbe un numero di ripristini superiore a quello che accade
// davvero. Analisi statica (stesso approccio degli altri
// verify-*-cascade*.test.ts): getArchivedPayers chiama requireUserId(), non
// eseguibile in un test Vitest puro.

const PAYERS_DATA_PATH = join(__dirname, "..", "lib", "data", "payers.ts");
const source = readFileSync(PAYERS_DATA_PATH, "utf-8");

function extractFunctionBody(fnName: string): string {
  const fnRegex = new RegExp(`export\\s+async\\s+function\\s+${fnName}\\s*\\(`);
  const match = fnRegex.exec(source);
  if (!match) {
    throw new Error(`Funzione ${fnName} non trovata in ${PAYERS_DATA_PATH}`);
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

const body = extractFunctionBody("getArchivedPayers");

it("il groupBy sui pazienti include archiviatoInCascata, non solo archiviato", () => {
  expect(body).toMatch(
    /paziente\.groupBy\s*\(\s*\{\s*by:\s*\[[^\]]*"archiviatoInCascata"[^\]]*\]/
  );
});

it("pazientiArchiviati conta solo i pazienti archiviati IN CASCATA (quelli che restorePayer ripristinerà davvero)", () => {
  expect(body).toMatch(
    /const pazientiArchiviati = pazientiByPayer\s*\n\s*\.filter\(\(p\) => p\.id_Pagante === payer\.id && p\.archiviato && p\.archiviatoInCascata\)/
  );
});
