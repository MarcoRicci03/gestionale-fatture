import { describe, expect, it } from "vitest";
import { buildInvoiceChangeDiff, type InvoiceMutableSnapshot } from "./change-diff";

const BASE: InvoiceMutableSnapshot = {
  id_Pagante: 1,
  id_Paziente: 2,
  data: new Date(2026, 4, 10, 12, 0, 0),
  mod_pag: "CONTANTI",
  sedute: 4,
  commento: null,
  citta: "Roma",
  cap: "00100",
  bolloCodice: null,
  mesi: [
    { mese: "GENNAIO", prezzo: 100 },
    { mese: "FEBBRAIO", prezzo: 50 },
  ],
};

describe("buildInvoiceChangeDiff", () => {
  it("nessuna modifica: oggetto vuoto", () => {
    const diff = buildInvoiceChangeDiff(BASE, { ...BASE, mesi: [...BASE.mesi] });
    expect(diff).toEqual({});
  });

  it("un campo scalare cambiato: solo quello compare nel diff", () => {
    const after: InvoiceMutableSnapshot = { ...BASE, citta: "Milano" };
    const diff = buildInvoiceChangeDiff(BASE, after);
    expect(diff).toEqual({ citta: { da: "Roma", a: "Milano" } });
  });

  it("più campi scalari cambiati: tutti compaiono nel diff", () => {
    const after: InvoiceMutableSnapshot = {
      ...BASE,
      cap: "20100",
      mod_pag: "BONIFICO",
      sedute: null,
    };
    const diff = buildInvoiceChangeDiff(BASE, after);
    expect(diff).toEqual({
      cap: { da: "00100", a: "20100" },
      mod_pag: { da: "CONTANTI", a: "BONIFICO" },
      sedute: { da: 4, a: null },
    });
  });

  it("data: confrontata e serializzata come ISO string", () => {
    const nuovaData = new Date(2026, 4, 20, 12, 0, 0);
    const diff = buildInvoiceChangeDiff(BASE, { ...BASE, data: nuovaData });
    expect(diff).toEqual({
      data: { da: BASE.data.toISOString(), a: nuovaData.toISOString() },
    });
  });

  it("id_Pagante/id_Paziente cambiati (riassegnazione)", () => {
    const diff = buildInvoiceChangeDiff(BASE, { ...BASE, id_Pagante: 9, id_Paziente: 8 });
    expect(diff).toEqual({
      id_Pagante: { da: 1, a: 9 },
      id_Paziente: { da: 2, a: 8 },
    });
  });

  it("mesi: importo di un mese esistente cambiato", () => {
    const after: InvoiceMutableSnapshot = {
      ...BASE,
      mesi: [
        { mese: "GENNAIO", prezzo: 120 },
        { mese: "FEBBRAIO", prezzo: 50 },
      ],
    };
    const diff = buildInvoiceChangeDiff(BASE, after);
    expect(diff).toEqual({
      mesi: {
        da: { GENNAIO: 100, FEBBRAIO: 50 },
        a: { GENNAIO: 120, FEBBRAIO: 50 },
      },
    });
  });

  it("mesi: stessi mesi/importi ma ordine diverso in input → nessun diff", () => {
    const after: InvoiceMutableSnapshot = {
      ...BASE,
      mesi: [
        { mese: "FEBBRAIO", prezzo: 50 },
        { mese: "GENNAIO", prezzo: 100 },
      ],
    };
    const diff = buildInvoiceChangeDiff(BASE, after);
    expect(diff).toEqual({});
  });

  it("mesi: mese aggiunto", () => {
    const after: InvoiceMutableSnapshot = {
      ...BASE,
      mesi: [...BASE.mesi, { mese: "MARZO", prezzo: 75 }],
    };
    const diff = buildInvoiceChangeDiff(BASE, after);
    expect(diff).toEqual({
      mesi: {
        da: { GENNAIO: 100, FEBBRAIO: 50 },
        a: { GENNAIO: 100, FEBBRAIO: 50, MARZO: 75 },
      },
    });
  });

  it("mesi: differenza di arrotondamento in floating point non genera un falso positivo", () => {
    const after: InvoiceMutableSnapshot = {
      ...BASE,
      mesi: [
        { mese: "GENNAIO", prezzo: 0.1 + 0.2 + 99.7 }, // 100 con errore di floating point
        { mese: "FEBBRAIO", prezzo: 50 },
      ],
    };
    const diff = buildInvoiceChangeDiff(BASE, after);
    expect(diff).toEqual({});
  });
});
