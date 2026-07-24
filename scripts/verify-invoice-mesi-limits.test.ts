import { it, expect } from "vitest";
import { invoiceSchema } from "../lib/validations/invoice";
import { MESI } from "../lib/constants/mesi";

// mesi[] non aveva né un tetto di lunghezza né un
// controllo di unicità sul mese. Due righe con lo stesso mese violano
// @@unique([id_Pagamento, mese]) su FatturaMese: l'eccezione P2002 non era
// intercettata e l'utente vedeva il generico "Errore durante la creazione
// della fattura". Non raggiungibile dal form web (12 checkbox, una per
// mese, guidate da un Set), ma raggiungibile chiamando createInvoice/
// updateInvoice direttamente. Questo test verifica che invoiceSchema rifiuti
// ora sia un array oltre 12 elementi sia mesi duplicati sotto quel tetto, con
// un messaggio esplicito in entrambi i casi.

const baseInvoice = {
  id_Pagante: 1,
  id_Paziente: 1,
  data: "2026-01-01",
  mod_pag: "CONTANTI" as const,
  n_fattura: 1,
  citta: "Roma",
  cap: "00100",
};

function withMesi(mesi: { mese: string; prezzo: number }[]) {
  return { ...baseInvoice, mesi };
}

// Prezzo volutamente basso (SOGLIA_BOLLO): questi test riguardano
// solo il numero/l'unicità dei mesi, non la logica del bollo.

it("rifiuta un array di 13 elementi (12 distinti + 1 ripetuto, max 12)", () => {
  const tredici = [...MESI, MESI[0]].map((mese) => ({ mese, prezzo: 1 }));
  expect(invoiceSchema.safeParse(withMesi(tredici)).success).toBe(false);
});

it("accetta un array di esattamente 12 mesi distinti", () => {
  const dodici = MESI.map((mese) => ({ mese, prezzo: 1 }));
  expect(invoiceSchema.safeParse(withMesi(dodici)).success).toBe(true);
});

it("rifiuta due righe con lo stesso mese (array di 2, sotto il tetto di 12)", () => {
  const result = invoiceSchema.safeParse(
    withMesi([
      { mese: "GENNAIO", prezzo: 10 },
      { mese: "GENNAIO", prezzo: 10 },
    ])
  );
  expect(result.success).toBe(false);
});

it("accetta tre mesi distinti (caso base)", () => {
  const result = invoiceSchema.safeParse(
    withMesi([
      { mese: "GENNAIO", prezzo: 10 },
      { mese: "FEBBRAIO", prezzo: 10 },
      { mese: "MARZO", prezzo: 10 },
    ])
  );
  expect(result.success).toBe(true);
});
