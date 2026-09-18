import { describe, expect, it } from "vitest";
import { maskDateInput, isDataPagamentoFutura } from "./date";

describe("maskDateInput", () => {
  it("aggiunge lo slash automaticamente dopo 2 cifre del giorno", () => {
    expect(maskDateInput("0", "")).toBe("0");
    expect(maskDateInput("01", "0")).toBe("01/");
  });

  it("aggiunge lo slash automaticamente dopo 2 cifre del mese", () => {
    expect(maskDateInput("01/0", "01/")).toBe("01/0");
    expect(maskDateInput("01/03", "01/0")).toBe("01/03/");
  });

  it("completa la data con l'anno a 4 cifre", () => {
    expect(maskDateInput("01/03/2", "01/03/")).toBe("01/03/2");
    expect(maskDateInput("01/03/2026", "01/03/202")).toBe("01/03/2026");
  });

  it("gestisce il Backspace su slash finale senza bloccarsi", () => {
    expect(maskDateInput("01", "01/")).toBe("0");
    expect(maskDateInput("01/03", "01/03/")).toBe("01/0");
  });

  it("gestisce l'inserimento manuale dello slash con padding a 2 cifre", () => {
    expect(maskDateInput("1/", "")).toBe("01/");
    expect(maskDateInput("01/3/", "01/3")).toBe("01/03/");
  });

  it("gestisce incolla di formato DD/MM/YYYY e DD-MM-YYYY", () => {
    expect(maskDateInput("01/03/2026", "")).toBe("01/03/2026");
    expect(maskDateInput("01-03-2026", "")).toBe("01/03/2026");
    expect(maskDateInput("1/3/2026", "")).toBe("01/03/2026");
  });

  it("gestisce incolla di formato ISO YYYY-MM-DD", () => {
    expect(maskDateInput("2026-03-01", "")).toBe("01/03/2026");
  });

  it("gestisce stringhe vuote", () => {
    expect(maskDateInput("", "01/")).toBe("");
  });
});

describe("isDataPagamentoFutura", () => {
  const referenceNow = new Date("2026-09-18T14:30:00");

  it("restituisce false se la data di pagamento è nel passato", () => {
    expect(isDataPagamentoFutura(new Date("2026-09-15"), new Date("2026-09-15"), referenceNow)).toBe(false);
    expect(isDataPagamentoFutura("2026-09-17", "2026-09-17", referenceNow)).toBe(false);
  });

  it("restituisce false se la data di pagamento è esattamente oggi", () => {
    expect(isDataPagamentoFutura(new Date("2026-09-18T10:00:00"), new Date("2026-09-18"), referenceNow)).toBe(false);
    expect(isDataPagamentoFutura("2026-09-18", "2026-09-18", referenceNow)).toBe(false);
  });

  it("restituisce true se la data di pagamento è nel futuro (domani o oltre)", () => {
    expect(isDataPagamentoFutura(new Date("2026-09-19T00:00:00"), new Date("2026-09-18"), referenceNow)).toBe(true);
    expect(isDataPagamentoFutura("2026-09-22", "2026-09-18", referenceNow)).toBe(true);
    expect(isDataPagamentoFutura("2026-09-26", "2026-09-18", referenceNow)).toBe(true);
    expect(isDataPagamentoFutura(new Date("2027-01-01"), new Date("2026-09-18"), referenceNow)).toBe(true);
  });

  it("fa fallback su dataFattura se dataPagamento è null o undefined", () => {
    expect(isDataPagamentoFutura(null, new Date("2026-09-17"), referenceNow)).toBe(false);
    expect(isDataPagamentoFutura(undefined, new Date("2026-09-25"), referenceNow)).toBe(true);
  });
});

