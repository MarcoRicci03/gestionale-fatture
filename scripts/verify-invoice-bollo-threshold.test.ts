import { it, expect } from "vitest";
import { invoiceSchema } from "../lib/validations/invoice";
import { SOGLIA_BOLLO } from "../lib/constants/bollo";

// La marca da bollo resta dovuta per legge sopra SOGLIA_BOLLO (77,47€), ma
// l'app non lo impone più a livello di validazione: un `superRefine` che
// rifiutava il parse sopra soglia senza bolloCodice è stato rimosso su
// scelta esplicita (comodità: il codice si aggiunge quando disponibile, e
// deve restare possibile toglierlo in modifica anche restando sopra soglia).
// invoiceSchema è condiviso da zodResolver (client) e da
// createInvoice/updateInvoice (lib/actions/invoices.ts): questo test
// verifica che né l'uno né l'altro blocchino più il caso, mentre il formato
// del codice (14 cifre), quando lo si inserisce, resta validato.

const baseInvoice = {
  id_Pagante: 1,
  id_Paziente: 1,
  data: "2026-01-01",
  mod_pag: "CONTANTI" as const,
  n_fattura: 1,
  citta: "Roma",
  cap: "00100",
};

it("accetta un totale sopra SOGLIA_BOLLO senza bolloCodice (creazione)", () => {
  const result = invoiceSchema.safeParse({
    ...baseInvoice,
    mesi: [{ mese: "GENNAIO", prezzo: SOGLIA_BOLLO + 0.01 }],
    bolloCodice: "",
  });
  expect(result.success).toBe(true);
});

it("consente di azzerare bolloCodice restando sopra SOGLIA_BOLLO (modifica)", () => {
  // Stesso schema usato da updateInvoice: parse con bolloCodice vuoto su una
  // fattura il cui totale resta sopra soglia deve avere successo, così è
  // possibile rimuovere un codice inserito per errore senza dover anche
  // abbassare l'importo sotto soglia.
  const result = invoiceSchema.safeParse({
    ...baseInvoice,
    mesi: [{ mese: "GENNAIO", prezzo: SOGLIA_BOLLO + 50 }],
    bolloCodice: "",
  });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.bolloCodice).toBeUndefined();
  }
});

it("accetta un totale sopra SOGLIA_BOLLO con bolloCodice valorizzato", () => {
  const result = invoiceSchema.safeParse({
    ...baseInvoice,
    mesi: [{ mese: "GENNAIO", prezzo: SOGLIA_BOLLO + 0.01 }],
    bolloCodice: "12345678901234",
  });
  expect(result.success).toBe(true);
});

it("rifiuta un bolloCodice con formato non valido, anche sopra soglia", () => {
  // L'obbligo di presenza è stato rimosso, ma se un codice viene fornito
  // deve comunque rispettare il formato a 14 cifre numeriche.
  const result = invoiceSchema.safeParse({
    ...baseInvoice,
    mesi: [{ mese: "GENNAIO", prezzo: SOGLIA_BOLLO + 0.01 }],
    bolloCodice: "abc",
  });
  expect(result.success).toBe(false);
});

it("accetta un totale esattamente pari a SOGLIA_BOLLO senza bolloCodice", () => {
  const result = invoiceSchema.safeParse({
    ...baseInvoice,
    mesi: [{ mese: "GENNAIO", prezzo: SOGLIA_BOLLO }],
    bolloCodice: "",
  });
  expect(result.success).toBe(true);
});

it("accetta un totale sotto SOGLIA_BOLLO senza bolloCodice", () => {
  const result = invoiceSchema.safeParse({
    ...baseInvoice,
    mesi: [{ mese: "GENNAIO", prezzo: 10 }],
    bolloCodice: "",
  });
  expect(result.success).toBe(true);
});
