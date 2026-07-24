import { it, expect } from "vitest";
import { invoiceSchema } from "../lib/validations/invoice";
import { SOGLIA_BOLLO } from "../lib/constants/bollo";

// SOGLIA_BOLLO era applicata solo nel form client (un
// avviso non bloccante) — createInvoice/updateInvoice, chiamate direttamente
// come Server Action, salvavano fatture sopra soglia senza bolloCodice
// valorizzato, cioè documenti fiscalmente non conformi. Questo test verifica
// che invoiceSchema (usato sia dal client via zodResolver sia dalle Server
// Action) rifiuti ora un totale sopra soglia senza bolloCodice, e continui ad
// accettare i casi legittimi.

const baseInvoice = {
  id_Pagante: 1,
  id_Paziente: 1,
  data: "2026-01-01",
  mod_pag: "CONTANTI" as const,
  n_fattura: 1,
  citta: "Roma",
  cap: "00100",
};

it("rifiuta un totale sopra SOGLIA_BOLLO senza bolloCodice", () => {
  const result = invoiceSchema.safeParse({
    ...baseInvoice,
    mesi: [{ mese: "GENNAIO", prezzo: SOGLIA_BOLLO + 0.01 }],
    bolloCodice: "",
  });
  expect(result.success).toBe(false);
});

it("accetta un totale sopra SOGLIA_BOLLO con bolloCodice valorizzato", () => {
  const result = invoiceSchema.safeParse({
    ...baseInvoice,
    mesi: [{ mese: "GENNAIO", prezzo: SOGLIA_BOLLO + 0.01 }],
    bolloCodice: "12345678901234",
  });
  expect(result.success).toBe(true);
});

it("accetta un totale esattamente pari a SOGLIA_BOLLO senza bolloCodice", () => {
  // Il rimedio richiede il bollo solo quando il totale SUPERA la soglia
  // (> 77,47€), non quando la eguaglia — coerente con SOGLIA_BOLLO e con il
  // testo del form ("Il totale supera...").
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

it("somma la soglia su più mesi (non il prezzo di un singolo mese)", () => {
  // Il totale rilevante è la somma di tutti i mesi, non il prezzo di un
  // singolo mese: verifica che il refine sommi correttamente l'array.
  const result = invoiceSchema.safeParse({
    ...baseInvoice,
    mesi: [
      { mese: "GENNAIO", prezzo: 40 },
      { mese: "FEBBRAIO", prezzo: 40 },
    ],
    bolloCodice: "",
  });
  expect(result.success).toBe(false);
});
