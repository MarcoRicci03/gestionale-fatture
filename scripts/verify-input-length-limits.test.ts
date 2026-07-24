import { describe, it, expect } from "vitest";
import { invoiceSchema } from "../lib/validations/invoice";
import { patientSchema } from "../lib/validations/patient";
import { payerSchema } from "../lib/validations/payer";
import { profileUpdateSchema } from "../lib/validations/profile";
import { pdfSettingsSchema, bloccoSchema } from "../lib/validations/pdf-settings";

// Diversi campi testuali accettavano stringhe di
// lunghezza arbitraria (nessun .max()), e i blob "ricchi" dell'editor PDF
// (richContent/descrizioneRichContent/valoreRichContent) erano JSON opachi
// senza alcun tetto di dimensione. Un client autenticato poteva scrivere
// payload enormi e ripeterlo, gonfiando il DB senza limite. Questo test
// verifica che ogni campo interessato rifiuti un input oltre soglia.

const baseValidInvoice = {
  id_Pagante: 1,
  id_Paziente: 1,
  data: "2026-01-01",
  mod_pag: "CONTANTI" as const,
  n_fattura: 1,
  // Prezzo volutamente sotto SOGLIA_BOLLO: questi test riguardano
  // solo i limiti di lunghezza dei campi testuali, non la logica del bollo.
  mesi: [{ mese: "GENNAIO", prezzo: 50 }],
  citta: "Roma",
  cap: "00100",
};

describe("invoiceSchema", () => {
  it("rifiuta commento oltre 2000 caratteri", () => {
    expect(
      invoiceSchema.safeParse({ ...baseValidInvoice, commento: "x".repeat(2001) }).success
    ).toBe(false);
  });
  it("accetta commento a 2000 caratteri", () => {
    expect(
      invoiceSchema.safeParse({ ...baseValidInvoice, commento: "x".repeat(2000) }).success
    ).toBe(true);
  });
  it("rifiuta citta oltre 100 caratteri", () => {
    expect(
      invoiceSchema.safeParse({ ...baseValidInvoice, citta: "x".repeat(101) }).success
    ).toBe(false);
  });
  it("rifiuta cap oltre 10 caratteri", () => {
    expect(
      invoiceSchema.safeParse({ ...baseValidInvoice, cap: "x".repeat(11) }).success
    ).toBe(false);
  });
});

describe("patientSchema", () => {
  it("rifiuta nome oltre 100 caratteri", () => {
    expect(
      patientSchema.safeParse({ nome: "x".repeat(101), cognome: "Rossi" }).success
    ).toBe(false);
  });
  it("rifiuta cognome oltre 100 caratteri", () => {
    expect(
      patientSchema.safeParse({ nome: "Mario", cognome: "x".repeat(101) }).success
    ).toBe(false);
  });
});

describe("payerSchema", () => {
  const basePayer = {
    nome: "Mario",
    cognome: "Rossi",
    via: "Via Roma 1",
    citta: "Roma",
    cap: "00100",
    cf: "RSSMRA80A01H501Z",
  };
  it("rifiuta via oltre 200 caratteri", () => {
    expect(payerSchema.safeParse({ ...basePayer, via: "x".repeat(201) }).success).toBe(false);
  });
  it("rifiuta citta oltre 100 caratteri", () => {
    expect(payerSchema.safeParse({ ...basePayer, citta: "x".repeat(101) }).success).toBe(false);
  });
});

describe("profileUpdateSchema", () => {
  it("rifiuta nome oltre 100 caratteri", () => {
    expect(profileUpdateSchema.safeParse({ nome: "x".repeat(101) }).success).toBe(false);
  });
  it("rifiuta specializzazione oltre 100 caratteri", () => {
    expect(
      profileUpdateSchema.safeParse({ specializzazione: "x".repeat(101) }).success
    ).toBe(false);
  });
});

function makeBlocco(overrides: Record<string, unknown> = {}) {
  return {
    id: "blocco-1",
    tipo: "testo",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    fontSize: 11,
    align: "left",
    visible: true,
    ...overrides,
  };
}

describe("bloccoSchema", () => {
  it("rifiuta testo oltre 10000 caratteri", () => {
    expect(
      bloccoSchema.safeParse(makeBlocco({ testo: "x".repeat(10_001) })).success
    ).toBe(false);
  });
  it("accetta testo a 10000 caratteri", () => {
    expect(
      bloccoSchema.safeParse(makeBlocco({ testo: "x".repeat(10_000) })).success
    ).toBe(true);
  });

  it("rifiuta richContent oltre la soglia di dimensione serializzata", () => {
    // richContent è un blob opaco (z.unknown()): il limite è sulla dimensione
    // serializzata, non sulla forma. Un array abbastanza grande da superare i
    // 50_000 caratteri una volta serializzato deve essere rifiutato.
    const hugeRichContent = {
      type: "doc",
      content: Array.from({ length: 5000 }, () => ({
        type: "text",
        text: "0123456789",
      })),
    };
    expect(
      bloccoSchema.safeParse(makeBlocco({ richContent: hugeRichContent })).success
    ).toBe(false);
  });
  it("accetta richContent di dimensione normale", () => {
    expect(
      bloccoSchema.safeParse(
        makeBlocco({ richContent: { type: "doc", content: [{ type: "text", text: "ok" }] } })
      ).success
    ).toBe(true);
  });
});

describe("pdfSettingsSchema.blocchi", () => {
  const basePdfSettings = { fontFamily: "Helvetica" };

  it("rifiuta più di 500 elementi", () => {
    const tooManyBlocchi = Array.from({ length: 501 }, (_, i) =>
      makeBlocco({ id: `blocco-${i}` })
    );
    expect(
      pdfSettingsSchema.safeParse({ ...basePdfSettings, blocchi: tooManyBlocchi }).success
    ).toBe(false);
  });

  it("accetta esattamente 500 elementi", () => {
    const exactlyMaxBlocchi = Array.from({ length: 500 }, (_, i) =>
      makeBlocco({ id: `blocco-${i}` })
    );
    expect(
      pdfSettingsSchema.safeParse({ ...basePdfSettings, blocchi: exactlyMaxBlocchi }).success
    ).toBe(true);
  });
});
