import type { Pagante, Paziente } from "@prisma/client";
import type { InvoiceListItem } from "./types";

// Fixture condivise dai test di components/invoices/*.test.tsx (invoices
// list e i suoi componenti figli: invoice-row-actions, invoices-table,
// invoices-card-list, invoice-detail-dialog, payer-detail-dialog,
// patient-detail-dialog). Prima duplicate quasi identiche in ciascun file,
// erano già divergenti tra loro: la versione di makePaziente in
// patient-detail-dialog.test.tsx ometteva `archiviatoInCascata` (campo
// obbligatorio non-null su Paziente, vedi prisma/schema.prisma) e compilava
// solo grazie a un cast `as Paziente & {...}` che nascondeva il campo
// mancante. Tipizzate contro i tipi reali, senza cast: se in futuro Prisma
// aggiunge un campo scalare obbligatorio, qui non compila più finché non lo
// si aggiunge.

export function makePagante(overrides: Partial<Pagante> = {}): Pagante {
  return {
    id: 1,
    id_Utente: 1,
    nome: "Mario",
    cognome: "Rossi",
    via: "Via Roma 1",
    citta: "Roma",
    cap: "00100",
    cf: "RSSMRA80A01H501Z",
    piva: null,
    archiviato: false,
    ...overrides,
  };
}

export function makePaziente(overrides: Partial<Paziente> = {}): Paziente {
  return {
    id: 1,
    id_Utente: 1,
    id_Pagante: 1,
    nome: "Luca",
    cognome: "Verdi",
    archiviato: false,
    archiviatoInCascata: false,
    ...overrides,
  };
}

export function makeInvoice(
  overrides: Partial<InvoiceListItem> = {}
): InvoiceListItem {
  return {
    id: 1,
    id_Utente: 1,
    id_Pagante: 1,
    id_Paziente: 1,
    prezzo_totale: 100,
    mod_pag: "BONIFICO",
    sedute: null,
    commento: null,
    n_fattura: 1,
    anno: 2026,
    data: new Date("2026-01-15"),
    data_pagamento: null,
    citta: "Roma",
    cap: "00100",
    pdfLayoutSnapshot: null,
    bolloCodice: null,
    snapshotAnagrafica: null,
    stato_ts: "DA_INVIARE",
    protocollo_ts: null,
    protocollo_cancellazione_ts: null,
    data_invio_ts: null,
    flag_opposizione: false,
    pagamento_tracciato: true,
    natura_iva: "N2.2",
    bollo: 0,
    pagante: null,
    paziente: null,
    mesi: [],
    ...overrides,
  };
}
