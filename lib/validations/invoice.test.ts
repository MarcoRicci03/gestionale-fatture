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

  it("rifiuta una data anteriore al 2000", () => {
    const r = invoiceSchema.safeParse({
      ...base,
      data: "1850-01-01",
      mesi: [{ mese: "GENNAIO", prezzo: "10" }],
    });
    expect(r.success).toBe(false);
  });

  it("rifiuta una data oltre l'anno corrente + 1", () => {
    const tooFarInFuture = new Date().getFullYear() + 2;
    const r = invoiceSchema.safeParse({
      ...base,
      data: `${tooFarInFuture}-01-01`,
      mesi: [{ mese: "GENNAIO", prezzo: "10" }],
    });
    expect(r.success).toBe(false);
  });

  it("accetta una data nell'anno corrente + 1", () => {
    const nextYear = new Date().getFullYear() + 1;
    const r = invoiceSchema.safeParse({
      ...base,
      data: `${nextYear}-01-01`,
      mesi: [{ mese: "GENNAIO", prezzo: "10" }],
    });
    expect(r.success).toBe(true);
  });

  it("accetta l'anno 2000, il limite inferiore", () => {
    const r = invoiceSchema.safeParse({
      ...base,
      data: "2000-01-01",
      mesi: [{ mese: "GENNAIO", prezzo: "10" }],
    });
    expect(r.success).toBe(true);
  });

  describe("natura_iva", () => {
    it("imposta 'N2.2' come default quando natura_iva è omessa", () => {
      const r = invoiceSchema.safeParse({
        ...base,
        mesi: [{ mese: "GENNAIO", prezzo: "10" }],
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.natura_iva).toBe("N2.2");
      }
    });

    it("accetta 'N2.2' ed 'N4'", () => {
      const r1 = invoiceSchema.safeParse({
        ...base,
        mesi: [{ mese: "GENNAIO", prezzo: "10" }],
        natura_iva: "N2.2",
      });
      expect(r1.success).toBe(true);
      if (r1.success) expect(r1.data.natura_iva).toBe("N2.2");

      const r2 = invoiceSchema.safeParse({
        ...base,
        mesi: [{ mese: "GENNAIO", prezzo: "10" }],
        natura_iva: "N4",
      });
      expect(r2.success).toBe(true);
      if (r2.success) expect(r2.data.natura_iva).toBe("N4");
    });

    it("rifiuta stringhe arbitrarie o non consentite per natura_iva", () => {
      const r = invoiceSchema.safeParse({
        ...base,
        mesi: [{ mese: "GENNAIO", prezzo: "10" }],
        natura_iva: "FOOBAR" as never,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("data_pagamento", () => {
    it("accetta data_pagamento non specificata o vuota impostando null", () => {
      const r1 = invoiceSchema.safeParse({
        ...base,
        mesi: [{ mese: "GENNAIO", prezzo: "10" }],
      });
      expect(r1.success).toBe(true);
      if (r1.success) expect(r1.data.data_pagamento).toBeNull();

      const r2 = invoiceSchema.safeParse({
        ...base,
        mesi: [{ mese: "GENNAIO", prezzo: "10" }],
        data_pagamento: "",
      });
      expect(r2.success).toBe(true);
      if (r2.success) expect(r2.data.data_pagamento).toBeNull();
    });

    it("accetta data_pagamento uguale alla data di emissione", () => {
      const r = invoiceSchema.safeParse({
        ...base,
        data: "2026-03-15",
        data_pagamento: "2026-03-15",
        mesi: [{ mese: "GENNAIO", prezzo: "10" }],
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.data_pagamento).not.toBeNull();
        expect(r.data.data_pagamento?.toISOString().slice(0, 10)).toBe("2026-03-15");
      }
    });

    it("accetta data_pagamento successiva alla data di emissione (stesso mese o mesi successivi)", () => {
      const r = invoiceSchema.safeParse({
        ...base,
        data: "2026-01-10",
        data_pagamento: "2026-02-15",
        mesi: [{ mese: "GENNAIO", prezzo: "10" }],
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.data_pagamento?.toISOString().slice(0, 10)).toBe("2026-02-15");
      }
    });

    it("accetta data_pagamento a cavallo d'anno (es. emissione 2025-12-30, incasso 2026-01-05)", () => {
      const r = invoiceSchema.safeParse({
        ...base,
        data: "2025-12-30",
        data_pagamento: "2026-01-05",
        mesi: [{ mese: "DICEMBRE", prezzo: "10" }],
      });
      expect(r.success).toBe(true);
    });

    it("RIFIUTA data_pagamento antecedente alla data di emissione", () => {
      const r = invoiceSchema.safeParse({
        ...base,
        data: "2026-03-20",
        data_pagamento: "2026-03-10",
        mesi: [{ mese: "GENNAIO", prezzo: "10" }],
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        const err = r.error.issues.find((e) => e.path.includes("data_pagamento"));
        expect(err).toBeDefined();
        expect(err?.message).toBe(
          "La data di pagamento deve essere uguale o successiva alla data di emissione della fattura"
        );
      }
    });

    it("RIFIUTA data_pagamento con anno oltre il limite consentito", () => {
      const nextYear = new Date().getFullYear() + 2;
      const r = invoiceSchema.safeParse({
        ...base,
        data: "2026-01-01",
        data_pagamento: `${nextYear}-01-01`,
        mesi: [{ mese: "GENNAIO", prezzo: "10" }],
      });
      expect(r.success).toBe(false);
    });
  });
});

