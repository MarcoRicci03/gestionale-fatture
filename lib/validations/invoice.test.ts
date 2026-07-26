import { describe, it, expect } from "vitest";
import { invoiceSchema } from "@/lib/validations/invoice";
import { SOGLIA_BOLLO } from "@/lib/constants/bollo";

const base = {
  id_Pagante: 1,
  id_Paziente: 1,
  data: "2026-01-01",
  mod_pag: "CONTANTI" as const,
  n_fattura: 1,
  citta: "Roma",
  cap: "00100",
};

describe("invoiceSchema", () => {
  it("accetta una fattura valida sotto soglia bollo", () => {
    const r = invoiceSchema.safeParse({
      ...base,
      mesi: [{ mese: "GENNAIO", prezzo: "50,00" }], // virgola decimale IT
      bolloCodice: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mesi[0].prezzo).toBe(50);
  });

  it("non richiede il codice bollo quando il totale supera la soglia (facoltativo per scelta)", () => {
    // Vedi scripts/verify-invoice-bollo-threshold.test.ts per la copertura
    // completa del comportamento: il bollo resta dovuto per legge, ma
    // l'app non blocca più il salvataggio/la modifica senza codice.
    const r = invoiceSchema.safeParse({
      ...base,
      mesi: [{ mese: "GENNAIO", prezzo: String(SOGLIA_BOLLO + 1) }],
      bolloCodice: "",
    });
    expect(r.success).toBe(true);
  });

  it("rifiuta un prezzo non numerico invece di degradarlo a 0", () => {
    const r = invoiceSchema.safeParse({
      ...base,
      mesi: [{ mese: "GENNAIO", prezzo: "abc" }],
    });
    expect(r.success).toBe(false);
  });

  it("rifiuta mesi duplicati", () => {
    const r = invoiceSchema.safeParse({
      ...base,
      mesi: [
        { mese: "GENNAIO", prezzo: "10" },
        { mese: "GENNAIO", prezzo: "10" },
      ],
    });
    expect(r.success).toBe(false);
  });
});
