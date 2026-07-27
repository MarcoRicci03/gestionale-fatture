import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Regressione per LOG-11: a differenza di restorePatient (che filtra su
// archiviato: true e controlla updated.count), archivePatient faceva un
// update senza condizione sullo stato di partenza. Archiviare un paziente
// già archiviato riusciva comunque e scriveva un evento di audit ridondante.
// Analisi statica (stesso approccio di verify-invoice-lifecycle.test.ts):
// non esegue le action (chiamano requireUserId(), che legge cookies() via
// next/headers e richiede un contesto di richiesta reale — non disponibile
// in un test Vitest puro).

const PATIENTS_ACTIONS_PATH = join(__dirname, "..", "lib", "actions", "patients.ts");

function extractFunctionBody(source: string, fnName: string): string {
  const fnRegex = new RegExp(`export\\s+async\\s+function\\s+${fnName}\\s*\\(`);
  const match = fnRegex.exec(source);
  if (!match) {
    throw new Error(`Funzione ${fnName} non trovata in ${PATIENTS_ACTIONS_PATH}`);
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

const source = readFileSync(PATIENTS_ACTIONS_PATH, "utf-8");

describe("archivePatient verifica lo stato di partenza", () => {
  const body = extractFunctionBody(source, "archivePatient");

  it("usa updateMany con archiviato: false nel where, non update senza condizione sullo stato", () => {
    expect(body).toMatch(
      /paziente\.updateMany\s*\(\s*\{[\s\S]*?where:\s*\{[\s\S]*?archiviato:\s*false/
    );
  });

  it("controlla count === 0 e restituisce un errore se il paziente non era tra gli attivi", () => {
    expect(body).toMatch(/\.count\s*===\s*0/);
  });

  it("non scrive l'audit se l'update non ha trovato nulla da archiviare", () => {
    // logAudit deve comparire dopo il controllo su count === 0 nel testo
    // della funzione, non prima (altrimenti verrebbe scritto comunque).
    const countCheckIndex = body.search(/\.count\s*===\s*0/);
    const logAuditIndex = body.search(/logAudit\s*\(/);
    expect(countCheckIndex).toBeGreaterThan(-1);
    expect(logAuditIndex).toBeGreaterThan(countCheckIndex);
  });
});
