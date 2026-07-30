import { describe, it, expect } from "vitest";
import type { Pagante, Paziente } from "@prisma/client";
import { getExportColumn, type ExportableInvoice } from "./column-catalog";
import { buildSnapshotAnagrafica } from "@/lib/invoices/anagrafica-snapshot";

// Regressione: le colonne pagante/paziente devono leggere lo stesso snapshot
// congelato usato dal PDF (lib/pdf/placeholders.ts), non le relazioni live,
// altrimenti PDF ed export Excel della stessa fattura possono mostrare
// indirizzi/CF diversi se l'anagrafica è cambiata dopo l'emissione.

const PAGANTE_ATTUALE: Pagante = {
  id: 1,
  id_Utente: 1,
  nome: "Mario",
  cognome: "Rossi",
  via: "Via Nuova 42",
  citta: "Milano",
  cap: "20100",
  cf: "RSSMRA80A01H501Z",
  piva: null,
  archiviato: false,
};

const PAZIENTE_ATTUALE: Paziente = {
  id: 1,
  id_Utente: 1,
  id_Pagante: 1,
  nome: "Giulia",
  cognome: "Rossi",
  archiviato: false,
  archiviatoInCascata: false,
};

const SNAPSHOT_EMISSIONE = {
  pagante: {
    nome: "Mario",
    cognome: "Rossi",
    via: "Via Vecchia 9",
    citta: "Roma",
    cap: "00100",
    cf: "RSSMRA80A01H501Z",
    piva: null,
  },
  paziente: { nome: "Giulia", cognome: "Rossi" },
};

function baseInvoice(
  overrides: Partial<ExportableInvoice> = {}
): ExportableInvoice {
  return {
    id: 1,
    id_Utente: 1,
    id_Pagante: 1,
    id_Paziente: 1,
    prezzo_totale: 50,
    mod_pag: "BONIFICO",
    sedute: null,
    commento: null,
    n_fattura: 1,
    anno: 2026,
    data: new Date("2026-01-15"),
    citta: "Roma",
    cap: "00100",
    bolloCodice: null,
    pdfLayoutSnapshot: null,
    snapshotAnagrafica: null,
    pagante: PAGANTE_ATTUALE,
    paziente: PAZIENTE_ATTUALE,
    mesi: [],
    ...overrides,
  } as ExportableInvoice;
}

describe("column-catalog — dati pagante/paziente dallo snapshot", () => {
  it("con lo snapshot presente, usa i dati congelati all'emissione, non quelli attuali", () => {
    const invoice = baseInvoice({ snapshotAnagrafica: SNAPSHOT_EMISSIONE });

    expect(getExportColumn("pagante_cognome_nome")!.getValue(invoice)).toBe(
      "Rossi Mario"
    );
    expect(getExportColumn("pagante_via")!.getValue(invoice)).toBe(
      "Via Vecchia 9"
    );
    expect(getExportColumn("pagante_citta")!.getValue(invoice)).toBe("Roma");
    expect(getExportColumn("pagante_cap")!.getValue(invoice)).toBe("00100");
    expect(getExportColumn("paziente_cognome_nome")!.getValue(invoice)).toBe(
      "Rossi Giulia"
    );
  });

  it("senza snapshot (fatture precedenti al fix), ricade sui dati attuali del pagante/paziente", () => {
    const invoice = baseInvoice({ snapshotAnagrafica: null });

    expect(getExportColumn("pagante_via")!.getValue(invoice)).toBe(
      PAGANTE_ATTUALE.via
    );
    expect(getExportColumn("pagante_citta")!.getValue(invoice)).toBe(
      PAGANTE_ATTUALE.citta
    );
  });

  it("CF/P.IVA null nello snapshot restituiscono 'n/d' invece di null", () => {
    const invoice = baseInvoice({
      snapshotAnagrafica: buildSnapshotAnagrafica(
        { ...PAGANTE_ATTUALE, cf: null, piva: null },
        PAZIENTE_ATTUALE
      ),
    });

    expect(getExportColumn("pagante_cf")!.getValue(invoice)).toBe("n/d");
    expect(getExportColumn("pagante_piva")!.getValue(invoice)).toBe("n/d");
  });
});

describe("column-catalog — bollo_importo / prezzo_totale_con_bollo", () => {
  it("bolloCodice presente: bollo_importo è 2, prezzo_totale_con_bollo somma il bollo", () => {
    const invoice = baseInvoice({
      prezzo_totale: 100,
      bolloCodice: "01234567890123",
    });

    expect(getExportColumn("bollo_importo")!.getValue(invoice)).toBe(2);
    expect(
      getExportColumn("prezzo_totale_con_bollo")!.getValue(invoice)
    ).toBe(102);
  });

  it("bolloCodice assente: bollo_importo è 0, prezzo_totale_con_bollo resta invariato", () => {
    const invoice = baseInvoice({ prezzo_totale: 100, bolloCodice: null });

    expect(getExportColumn("bollo_importo")!.getValue(invoice)).toBe(0);
    expect(
      getExportColumn("prezzo_totale_con_bollo")!.getValue(invoice)
    ).toBe(100);
  });

  it("bollo_importo/prezzo_totale_con_bollo non dipendono dalla soglia SOGLIA_BOLLO (a differenza di bollo_dovuto)", () => {
    // Totale sotto soglia ma con bolloCodice comunque inserito: il bollo va
    // comunque sommato, perché la regola è "codice presente", non "soglia
    // superata" (vedi lib/invoices/bollo-total.ts).
    const invoice = baseInvoice({ prezzo_totale: 10, bolloCodice: "01234567890123" });

    expect(getExportColumn("bollo_dovuto")!.getValue(invoice)).toBe("No");
    expect(getExportColumn("bollo_importo")!.getValue(invoice)).toBe(2);
    expect(
      getExportColumn("prezzo_totale_con_bollo")!.getValue(invoice)
    ).toBe(12);
  });
});
