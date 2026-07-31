import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Regressione per l'archiviazione a cascata pagante -> pazienti (piano
// 2026-07-23, task 2). Analisi statica (stesso approccio di
// verify-invoice-lifecycle.test.ts): verifica che il codice sorgente di
// lib/actions/payers.ts contenga ancora la cascata su pazienti dentro una
// transazione interattiva, così una futura modifica che la rimuova per
// errore viene segnalata invece di passare inosservata. Non esegue le
// action (chiamano requireUserId(), che legge cookies() via next/headers e
// richiede un contesto di richiesta reale — non disponibile in un test
// Vitest puro).

const PAYERS_ACTIONS_PATH = join(__dirname, "..", "lib", "actions", "payers.ts");

function extractFunctionBody(source: string, fnName: string): string {
  const fnRegex = new RegExp(`export\\s+async\\s+function\\s+${fnName}\\s*\\(`);
  const match = fnRegex.exec(source);
  if (!match) {
    throw new Error(`Funzione ${fnName} non trovata in ${PAYERS_ACTIONS_PATH}`);
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

const source = readFileSync(PAYERS_ACTIONS_PATH, "utf-8");

describe("archivePayer archivia in cascata i pazienti attivi del pagante", () => {
  const body = extractFunctionBody(source, "archivePayer");

  it("esegue l'archiviazione dentro una transazione interattiva", () => {
    expect(body).toMatch(/\$transaction\s*\(\s*async\s*\(tx\)\s*=>\s*\{/);
  });

  it("archivia anche i pazienti attivi collegati (paziente.updateMany con archiviato: true)", () => {
    expect(body).toMatch(
      /tx\.paziente\.updateMany\s*\(\s*\{[\s\S]*?data:\s*\{\s*archiviato:\s*true/
    );
  });

  it("marca i pazienti archiviati ora come archiviati IN CASCATA (LOG-09), non manualmente", () => {
    expect(body).toMatch(
      /tx\.paziente\.updateMany\s*\(\s*\{[\s\S]*?data:\s*\{\s*archiviato:\s*true,\s*archiviatoInCascata:\s*true/
    );
  });

  it("registra nell'audit quanti pazienti sono stati archiviati in cascata", () => {
    expect(body).toMatch(/pazientiArchiviatiInCascata/);
  });
});

describe("archivePayer verifica lo stato di partenza (LOG-04)", () => {
  const body = extractFunctionBody(source, "archivePayer");

  it("controlla che il pagante sia tra gli attivi (archiviato: false) prima di archiviarlo", () => {
    expect(body).toMatch(
      /pagante\.findFirst\s*\(\s*\{[\s\S]*?where:\s*\{[\s\S]*?archiviato:\s*false/
    );
  });

  it("restituisce un errore esplicito se il pagante non era tra gli attivi", () => {
    expect(body).toMatch(/if\s*\(\s*!payer\s*\)\s*\{[\s\S]*?return\s*\{\s*error:/);
  });

  it("non scrive l'audit se il controllo sullo stato di partenza fallisce", () => {
    // Lo stesso ragionamento di verify-patient-archive-idempotency.test.ts:
    // il controllo su !payer deve comparire prima di logAudit nel testo
    // della funzione, non dopo (altrimenti l'evento verrebbe scritto anche
    // quando l'archiviazione non è mai partita).
    const stateCheckIndex = body.search(/if\s*\(\s*!payer\s*\)/);
    const logAuditIndex = body.search(/logAudit\s*\(/);
    expect(stateCheckIndex).toBeGreaterThan(-1);
    expect(logAuditIndex).toBeGreaterThan(stateCheckIndex);
  });
});

describe("restorePayer ripristina in cascata i pazienti archiviati del pagante", () => {
  const body = extractFunctionBody(source, "restorePayer");

  it("esegue il ripristino dentro una transazione interattiva", () => {
    expect(body).toMatch(/\$transaction\s*\(\s*async\s*\(tx\)\s*=>\s*\{/);
  });

  it("ripristina anche i pazienti archiviati collegati (paziente.updateMany con archiviato: false)", () => {
    expect(body).toMatch(
      /tx\.paziente\.updateMany\s*\(\s*\{[\s\S]*?data:\s*\{\s*archiviato:\s*false/
    );
  });

  it("ripristina SOLO i pazienti archiviati in cascata (LOG-09), non quelli archiviati manualmente prima", () => {
    expect(body).toMatch(
      /tx\.paziente\.updateMany\s*\(\s*\{\s*where:\s*\{[\s\S]*?archiviato:\s*true,\s*archiviatoInCascata:\s*true/
    );
  });

  it("azzera archiviatoInCascata sui pazienti ripristinati, per non far rimanere una cascata passata su una futura archiviazione manuale", () => {
    expect(body).toMatch(
      /tx\.paziente\.updateMany\s*\(\s*\{[\s\S]*?data:\s*\{\s*archiviato:\s*false,\s*archiviatoInCascata:\s*false/
    );
  });
});

describe("revalidatePayerViews revalida anche /patients", () => {
  it("la cascata sui pazienti richiede che /patients venga revalidato", () => {
    const fnRegex = /function\s+revalidatePayerViews\s*\(\s*\)\s*\{/;
    const match = fnRegex.exec(source);
    expect(match).not.toBeNull();
    const openBrace = source.indexOf("{", match!.index);
    let depth = 0;
    let body = "";
    for (let i = openBrace; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          body = source.slice(openBrace, i + 1);
          break;
        }
      }
    }
    expect(body).toMatch(/revalidatePath\(\s*["']\/patients["']\s*\)/);
  });
});
