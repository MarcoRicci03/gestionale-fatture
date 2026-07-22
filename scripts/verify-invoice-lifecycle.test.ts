import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Regressione LOG-03/LOG-04 in SECURITY_AUDIT.md. Analisi statica (stesso
// approccio di verify-account-cache-invalidation.test.ts): verifica che il
// codice sorgente di lib/actions/invoices.ts contenga ancora i controlli
// introdotti, così una futura modifica che li rimuova per errore viene
// segnalata invece di passare inosservata. Non esegue le action (chiamano
// requireUserId(), che legge cookies() via next/headers e richiede un
// contesto di richiesta reale — non disponibile in un test Vitest puro).

const INVOICES_ACTIONS_PATH = join(
  __dirname,
  "..",
  "lib",
  "actions",
  "invoices.ts"
);

function extractFunctionBody(source: string, fnName: string): string {
  const fnRegex = new RegExp(`export\\s+async\\s+function\\s+${fnName}\\s*\\(`);
  const match = fnRegex.exec(source);
  if (!match) {
    throw new Error(`Funzione ${fnName} non trovata in ${INVOICES_ACTIONS_PATH}`);
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

const source = readFileSync(INVOICES_ACTIONS_PATH, "utf-8");

describe("deleteInvoice annulla invece di cancellare (LOG-03)", () => {
  const body = extractFunctionBody(source, "deleteInvoice");

  it("non chiama più prisma.pagamento.delete", () => {
    expect(body).not.toMatch(/pagamento\.delete\s*\(/);
  });

  it("imposta annullata: true tramite un update", () => {
    expect(body).toMatch(/pagamento\.update\s*\(/);
    expect(body).toMatch(/annullata:\s*true/);
  });
});

describe("updateInvoice blocca numero e anno (LOG-04)", () => {
  const body = extractFunctionBody(source, "updateInvoice");

  it("confronta n_fattura con il valore esistente prima di aggiornare", () => {
    expect(body).toMatch(/n_fattura\s*!==\s*existing\.n_fattura/);
  });

  it("confronta l'anno con il valore esistente prima di aggiornare", () => {
    expect(body).toMatch(/year\s*!==\s*existing\.anno/);
  });

  it("verifica la consequenzialità cronologica chiamando findChronologyConflict", () => {
    expect(body).toMatch(/findChronologyConflict\s*\(/);
  });
});

describe("createInvoice verifica la consequenzialità cronologica (LOG-04)", () => {
  const body = extractFunctionBody(source, "createInvoice");

  it("chiama findChronologyConflict prima di creare la fattura", () => {
    expect(body).toMatch(/findChronologyConflict\s*\(/);
  });
});
