import { describe, it, expect } from "vitest";
import { invoiceSchema } from "../lib/validations/invoice";

// mesi[].prezzo trasformava qualunque input non
// numerico (es. "50,00", virgola decimale italiana, o testo arbitrario) in
// NaN e poi lo degradava silenziosamente a 0 — una fattura poteva essere
// salvata con un importo sbagliato senza alcun errore di validazione. Questo
// test verifica che invoiceSchema ora rifiuti l'input non parsabile invece di
// inghiottirlo, normalizzi la virgola italiana in punto, e vincoli il prezzo
// a un numero non negativo con al massimo 2 decimali.

const baseInvoice = {
  id_Pagante: 1,
  id_Paziente: 1,
  data: "2026-01-01",
  mod_pag: "CONTANTI" as const,
  n_fattura: 1,
  citta: "Roma",
  cap: "00100",
};

function withPrezzo(prezzo: unknown) {
  return { ...baseInvoice, mesi: [{ mese: "GENNAIO", prezzo }] };
}

function parsedPrezzo(result: ReturnType<typeof invoiceSchema.safeParse>): number {
  if (!result.success) throw new Error("parse fallito");
  const data = result.data as unknown as { mesi: { prezzo: number }[] };
  return data.mesi[0].prezzo;
}

it("rifiuta testo non numerico ('abc') invece di degradarlo a 0", () => {
  expect(invoiceSchema.safeParse(withPrezzo("abc")).success).toBe(false);
});

describe("normalizza la virgola decimale italiana", () => {
  it("'50,00' -> 50", () => {
    const result = invoiceSchema.safeParse(withPrezzo("50,00"));
    expect(result.success).toBe(true);
    expect(parsedPrezzo(result)).toBe(50);
  });
  it("'12,5' -> 12.5", () => {
    const result = invoiceSchema.safeParse(withPrezzo("12,5"));
    expect(result.success).toBe(true);
    expect(parsedPrezzo(result)).toBe(12.5);
  });
});

it("accetta il punto decimale ('50.40')", () => {
  const result = invoiceSchema.safeParse(withPrezzo("50.40"));
  expect(result.success).toBe(true);
  expect(parsedPrezzo(result)).toBe(50.4);
});

it("una stringa vuota resta 0 (mese senza importo)", () => {
  // Un solo mese a "" farebbe fallire anche il refine "totale > 0"
  // preesistente (indipendente da questo fix): aggiunto un secondo mese con
  // importo positivo per isolare il comportamento di "" sul primo.
  const result = invoiceSchema.safeParse({
    ...baseInvoice,
    mesi: [
      { mese: "GENNAIO", prezzo: "" },
      { mese: "FEBBRAIO", prezzo: 10 },
    ],
  });
  expect(result.success).toBe(true);
  expect(parsedPrezzo(result)).toBe(0);
});

it("rifiuta più di 2 decimali ('50,123')", () => {
  expect(invoiceSchema.safeParse(withPrezzo("50,123")).success).toBe(false);
});

it("rifiuta un valore negativo ('-10')", () => {
  expect(invoiceSchema.safeParse(withPrezzo("-10")).success).toBe(false);
});

it("accetta un numero JS valido (50)", () => {
  const result = invoiceSchema.safeParse(withPrezzo(50));
  expect(result.success).toBe(true);
  expect(parsedPrezzo(result)).toBe(50);
});

it("rifiuta un numero JS con più di 2 decimali (50.123)", () => {
  expect(invoiceSchema.safeParse(withPrezzo(50.123)).success).toBe(false);
});
