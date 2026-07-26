import { describe, it, expect } from "vitest";
import { roundCurrency } from "../lib/utils/currency";

// Gli importi diventano `number` non appena escono dal data layer (Decimal),
// e sommarli in JS può produrre errore di virgola mobile (es.
// 0.1 + 0.2 !== 0.3). roundCurrency elimina questo drift.
//
// Storicamente questo file copriva anche un caso concreto in cui il drift
// avrebbe potuto far apparire un totale come "sopra SOGLIA_BOLLO" quando in
// realtà la eguagliava soltanto, dentro il `superRefine` di invoiceSchema
// che rendeva bolloCodice obbligatorio sopra soglia. Quel superRefine è
// stato rimosso (il bollo resta dovuto per legge ma non è più imposto dalla
// validazione, vedi scripts/verify-invoice-bollo-threshold.test.ts), quindi
// quel confronto non esiste più a livello di schema. roundCurrency resta
// comunque rilevante per il confronto equivalente lato UI
// (invoice-form.tsx, invoices-manager.tsx: "bollo dovuto/non dovuto") e per
// {{fattura.totaleConBollo}} (lib/pdf/placeholders.ts) — non testabile qui
// in isolamento senza montare quei componenti, quindi resta la sola
// funzione pura sotto test.

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
