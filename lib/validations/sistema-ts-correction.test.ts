import { describe, it, expect } from "vitest";
import { correggiFatturaTsSchema } from "./sistema-ts-correction";

describe("correggiFatturaTsSchema — CR-05", () => {
  it("lascia undefined i campi persistiti non inviati", () => {
    const parsed = correggiFatturaTsSchema.parse({ invoiceId: 1 });

    expect(parsed.dataPagamento).toBeUndefined();
    expect(parsed.flagOpposizione).toBeUndefined();
    expect(parsed.pagamentoTracciato).toBeUndefined();
    expect(parsed.bolloCodice).toBeUndefined();
    expect(parsed.paganteCf).toBeUndefined();
  });

  it("mantiene i default delle sole opzioni di comportamento", () => {
    const parsed = correggiFatturaTsSchema.parse({ invoiceId: 1 });

    expect(parsed.aggiornaAnagrafica).toBe(true);
    expect(parsed.propagaFattureInAttesa).toBe(false);
  });

  it("trasforma stringhe vuote e null in null (svuotamento esplicito)", () => {
    const parsed = correggiFatturaTsSchema.parse({
      invoiceId: 1,
      dataPagamento: "",
      bolloCodice: "",
      paganteCf: "",
    });

    expect(parsed.dataPagamento).toBeNull();
    expect(parsed.bolloCodice).toBeNull();
    expect(parsed.paganteCf).toBeNull();
    expect(correggiFatturaTsSchema.parse({ invoiceId: 1, dataPagamento: null }).dataPagamento).toBeNull();
  });

  it("converte la data di incasso in una Date a mezzogiorno locale", () => {
    const parsed = correggiFatturaTsSchema.parse({
      invoiceId: 1,
      dataPagamento: "2026-03-10",
    });

    expect(parsed.dataPagamento).toBeInstanceOf(Date);
    const d = parsed.dataPagamento as Date;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 10, 12]);
  });

  it("conserva i booleani inviati esplicitamente", () => {
    const parsed = correggiFatturaTsSchema.parse({
      invoiceId: 1,
      flagOpposizione: false,
      pagamentoTracciato: false,
    });

    expect(parsed.flagOpposizione).toBe(false);
    expect(parsed.pagamentoTracciato).toBe(false);
  });
});
