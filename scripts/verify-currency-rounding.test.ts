import { describe, it, expect } from "vitest";
import { roundCurrency } from "../lib/utils/currency";
import { invoiceSchema } from "../lib/validations/invoice";
import { SOGLIA_BOLLO } from "../lib/constants/bollo";

// Gli importi diventano `number` non appena escono dal
// data layer (Decimal), e sommarli in JS può produrre errore di virgola
// mobile (es. 0.1 + 0.2 !== 0.3). Applicato ai punti individuati
// dall'audit: la soglia del bollo (lib/validations/invoice.ts, già coperta
// anche da verify-invoice-bollo-threshold.test.ts) e
// {{fattura.totaleConBollo}} (lib/pdf/placeholders.ts). Questo test verifica
// prima la funzione di arrotondamento in isolamento, poi un caso concreto in
// cui il drift in virgola mobile avrebbe potuto spostare il confronto con
// SOGLIA_BOLLO sul lato sbagliato senza l'arrotondamento.

describe("roundCurrency", () => {
  it("elimina il drift di 0.1 + 0.2", () => {
    const drift = 0.1 + 0.2; // 0.30000000000000004 in IEEE 754
    expect(
      drift,
      "Precondizione del test non verificata: 0.1 + 0.2 risulta esatto in questo runtime, il test non è significativo"
    ).not.toBe(0.3);
    expect(roundCurrency(drift)).toBe(0.3);
  });

  it("arrotonda a 2 decimali", () => {
    expect(roundCurrency(79.47000000001)).toBe(79.47);
  });

  it("roundCurrency(0) resta 0", () => {
    expect(roundCurrency(0)).toBe(0);
  });
});

it("il confronto con SOGLIA_BOLLO resiste al drift su somme multi-mese", () => {
  // Tre mesi la cui somma matematica è esattamente SOGLIA_BOLLO (77.47), ma
  // che sommati in virgola mobile IEEE 754 danno 77.47000000000001: senza
  // roundCurrency il confronto `totale > SOGLIA_BOLLO` nel superRefine di
  // invoiceSchema risulterebbe `true` per un errore di arrotondamento di un
  // centesimo di centesimo, non perché il totale superi davvero la soglia.
  const mesi = [
    { mese: "GENNAIO", prezzo: 0.01 },
    { mese: "FEBBRAIO", prezzo: 0.03 },
    { mese: "MARZO", prezzo: 77.43 },
  ];
  const sommaGrezza = mesi.reduce((s, m) => s + m.prezzo, 0);
  expect(
    sommaGrezza,
    "Precondizione del test non verificata: la somma grezza in virgola mobile risulta già esatta in questo runtime, il test non è significativo"
  ).not.toBe(SOGLIA_BOLLO);

  const result = invoiceSchema.safeParse({
    id_Pagante: 1,
    id_Paziente: 1,
    data: "2026-01-01",
    mod_pag: "CONTANTI" as const,
    n_fattura: 1,
    citta: "Roma",
    cap: "00100",
    mesi,
    bolloCodice: "",
  });

  expect(result.success).toBe(true);
});
