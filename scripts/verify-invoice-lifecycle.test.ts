import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Analisi statica (stesso approccio di
// verify-account-cache-invalidation.test.ts): verifica che il
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

describe("deleteInvoice cancella fisicamente la fattura", () => {
  const body = extractFunctionBody(source, "deleteInvoice");

  it("chiama prisma.pagamento.delete", () => {
    expect(body).toMatch(/pagamento\.delete\s*\(/);
  });

  it("non fa più riferimento al campo annullata", () => {
    expect(body).not.toMatch(/annullata/);
  });

  it("registra un evento di audit con un meta strutturato", () => {
    expect(body).toMatch(/logAudit\s*\(/);
    expect(body).toMatch(/meta:\s*\{/);
  });
});

describe("updateInvoice blocca numero e anno", () => {
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

describe("createInvoice verifica la consequenzialità cronologica", () => {
  const body = extractFunctionBody(source, "createInvoice");

  it("chiama findChronologyConflict prima di creare la fattura", () => {
    expect(body).toMatch(/findChronologyConflict\s*\(/);
  });
});

describe("createInvoice cattura lo snapshot anagrafica", () => {
  const body = extractFunctionBody(source, "createInvoice");

  it("chiama buildSnapshotAnagrafica prima di creare la fattura", () => {
    expect(body).toMatch(/buildSnapshotAnagrafica\s*\(/);
  });
});

describe("createInvoice cattura lo snapshot layout PDF in modo atomico", () => {
  const body = extractFunctionBody(source, "createInvoice");

  it("include pdfLayoutSnapshot nel data del create", () => {
    expect(body).toMatch(/pagamento\.create\s*\([\s\S]*pdfLayoutSnapshot:/);
  });

  it("non usa più un update separato best-effort snapshotPdfLayoutForInvoice", () => {
    expect(body).not.toMatch(/snapshotPdfLayoutForInvoice/);
  });
});

describe("updateInvoice ricattura lo snapshot solo se cambia pagante/paziente", () => {
  const body = extractFunctionBody(source, "updateInvoice");

  it("confronta id_Pagante/id_Paziente con l'esistente prima di ricatturare", () => {
    expect(body).toMatch(/id_Pagante\s*!==\s*existing\.id_Pagante/);
    expect(body).toMatch(/id_Paziente\s*!==\s*existing\.id_Paziente/);
  });

  it("chiama buildSnapshotAnagrafica solo dentro un ramo condizionale", () => {
    expect(body).toMatch(/anagraficaCambiata[\s\S]*buildSnapshotAnagrafica\s*\(/);
  });
});

describe("refreshInvoiceAnagrafica esiste e ricattura dalle relazioni live", () => {
  const body = extractFunctionBody(source, "refreshInvoiceAnagrafica");

  it("recupera pagante e paziente dal DB", () => {
    expect(body).toMatch(/include:\s*\{\s*pagante:\s*true,\s*paziente:\s*true/);
  });

  it("chiama buildSnapshotAnagrafica sulle relazioni live", () => {
    expect(body).toMatch(/buildSnapshotAnagrafica\s*\(\s*invoice\.pagante,\s*invoice\.paziente/);
  });

  it("registra un evento di audit", () => {
    expect(body).toMatch(/logAudit\s*\(/);
  });
});
