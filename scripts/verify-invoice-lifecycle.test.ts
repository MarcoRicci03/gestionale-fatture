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

// Estrae il testo tra la parentesi/graffa/parentesi-quadra di apertura in
// openIndex e la sua chiusura corrispondente, contando la profondità (serve a
// isolare gli argomenti di una chiamata senza affidarsi a regex non-greedy,
// che si spezzerebbero sulle graffe annidate, es. mesi.map((m) => ({ ... })).
function extractBalanced(source: string, openIndex: number): string {
  const open = source[openIndex];
  const close = open === "(" ? ")" : open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === open) depth++;
    else if (source[i] === close) {
      depth--;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  throw new Error("Blocco non terminato correttamente");
}

// Divide la lista di argomenti di una chiamata (comprensiva delle parentesi
// esterne) nei singoli argomenti di primo livello, senza spezzarsi su
// graffe/parentesi annidate all'interno di un singolo argomento.
function splitTopLevelArgs(callWithParens: string): string[] {
  const inner = callWithParens.slice(1, -1);
  const args: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of inner) {
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    if (ch === "}" || ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      args.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current);
  return args;
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

  // Un pagante/paziente archiviato DOPO l'emissione di una fattura non deve
  // impedirne la modifica se non lo si sta riassegnando: validateInvoiceRelations
  // esenta dal filtro archiviato: false solo l'id che coincide con quello già
  // salvato (vedi lib/invoices/contact-options.ts per il fix lato form).
  it("passa a validateInvoiceRelations gli id_Pagante/id_Paziente esistenti", () => {
    expect(body).toMatch(
      /validateInvoiceRelations\(\s*userId,\s*id_Pagante,\s*id_Paziente,\s*\{\s*id_Pagante:\s*existing\.id_Pagante,\s*id_Paziente:\s*existing\.id_Paziente\s*\}/
    );
  });
});

describe("validateInvoiceRelations esenta dal filtro archiviato solo l'id invariato", () => {
  it("accetta un parametro opzionale 'unchanged'", () => {
    expect(source).toMatch(
      /unchanged\?:\s*\{\s*id_Pagante:\s*number;\s*id_Paziente:\s*number\s*\}/
    );
  });

  it("il filtro archiviato: false su pagante è condizionato a unchanged.id_Pagante", () => {
    expect(source).toMatch(/unchanged\?\.id_Pagante\s*===\s*id_Pagante/);
  });

  it("il filtro archiviato: false su paziente è condizionato a unchanged.id_Paziente", () => {
    expect(source).toMatch(/unchanged\?\.id_Paziente\s*===\s*id_Paziente/);
  });
});

describe("createInvoice verifica la consequenzialità cronologica", () => {
  const body = extractFunctionBody(source, "createInvoice");

  it("chiama findChronologyConflict prima di creare la fattura", () => {
    expect(body).toMatch(/findChronologyConflict\s*\(/);
  });
});

describe("createInvoice richiede sempre un contatto attivo", () => {
  const body = extractFunctionBody(source, "createInvoice");

  it("chiama validateInvoiceRelations senza il parametro 'unchanged' (nessun existing da confrontare in creazione)", () => {
    expect(body).toMatch(
      /validateInvoiceRelations\(\s*userId,\s*id_Pagante,\s*id_Paziente\s*\)/
    );
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

describe("updateInvoice registra nell'audit i campi effettivamente cambiati (LOG-03)", () => {
  const body = extractFunctionBody(source, "updateInvoice");

  it("la select di 'existing' include i campi mutabili necessari al diff", () => {
    expect(body).toMatch(/select:\s*\{[\s\S]*n_fattura:\s*true/);
    expect(body).toMatch(/data:\s*true/);
    expect(body).toMatch(/mod_pag:\s*true/);
    expect(body).toMatch(/sedute:\s*true/);
    expect(body).toMatch(/commento:\s*true/);
    expect(body).toMatch(/citta:\s*true/);
    expect(body).toMatch(/cap:\s*true/);
    expect(body).toMatch(/bolloCodice:\s*true/);
    expect(body).toMatch(/mesi:\s*\{\s*select:\s*\{\s*mese:\s*true,\s*prezzo:\s*true/);
  });

  it("chiama buildInvoiceChangeDiff prima di logAudit", () => {
    expect(body).toMatch(/buildInvoiceChangeDiff\s*\(/);
  });

  it("passa lo snapshot 'existing' (prima dell'update) come primo argomento e i valori aggiornati come secondo, non invertiti", () => {
    // Analisi statica sugli argomenti reali della chiamata (non solo sul nome
    // della funzione): un futuro swap prima/dopo invertirebbe ogni valore
    // da/a nel diff di audit, quindi va rilevato esplicitamente.
    const callNameIndex = body.search(/buildInvoiceChangeDiff\s*\(/);
    const openParenIndex = body.indexOf("(", callNameIndex);
    const fullCall = extractBalanced(body, openParenIndex);
    const [firstArg, secondArg] = splitTopLevelArgs(fullCall);

    expect(firstArg).toMatch(/existing\.id_Pagante/);
    expect(firstArg).toMatch(/existing\.mesi/);

    expect(secondArg).not.toMatch(/existing\./);
    expect(secondArg).toMatch(/\bid_Pagante,/);
  });

  it("passa 'modifiche' nel meta dell'evento INVOICE_UPDATE, non solo n_fattura/anno", () => {
    const logAuditCall = body.slice(body.indexOf("AUDIT_ACTIONS.INVOICE_UPDATE"));
    expect(logAuditCall).toMatch(/meta:\s*\{[^}]*modifiche/);
  });
});
