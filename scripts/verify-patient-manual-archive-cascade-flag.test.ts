import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Regressione per LOG-09 (lato lib/actions/patients.ts, complementare a
// scripts/verify-payer-archive-cascade.test.ts che copre lib/actions/payers.ts):
// un'archiviazione/ripristino MANUALE del singolo paziente deve sempre
// azzerare esplicitamente archiviatoInCascata, non solo affidarsi al
// default — altrimenti una cascata passata (archivePayer) potrebbe
// "ricordarsi" in modo scorretto su un ciclo successivo di
// archiviazione/ripristino indipendente dal pagante. Analisi statica
// (stesso approccio di verify-patient-archive-idempotency.test.ts): non
// esegue le action (requireUserId() richiede un contesto di richiesta
// reale, non disponibile in un test Vitest puro).

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

describe("archivePatient azzera archiviatoInCascata (LOG-09): è un'archiviazione manuale, mai una cascata", () => {
  const body = extractFunctionBody(source, "archivePatient");

  it("paziente.updateMany imposta archiviatoInCascata: false insieme a archiviato: true", () => {
    expect(body).toMatch(
      /paziente\.updateMany\s*\(\s*\{[\s\S]*?data:\s*\{\s*archiviato:\s*true,\s*archiviatoInCascata:\s*false/
    );
  });
});

describe("restorePatient azzera archiviatoInCascata (LOG-09): ripristino manuale indipendente da restorePayer", () => {
  const body = extractFunctionBody(source, "restorePatient");

  it("paziente.updateMany imposta archiviatoInCascata: false insieme a archiviato: false", () => {
    expect(body).toMatch(
      /paziente\.updateMany\s*\(\s*\{[\s\S]*?data:\s*\{\s*archiviato:\s*false,\s*archiviatoInCascata:\s*false/
    );
  });
});
