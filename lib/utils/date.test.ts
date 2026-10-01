import { describe, expect, it } from "vitest";
import { maskDateInput, isDataPagamentoFutura, isValidCalendarDateString, parseDateInput } from "./date";

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

describe("isValidCalendarDateString", () => {
  it("valida correttamente date reali del calendario", () => {
    expect(isValidCalendarDateString("2026-01-31")).toBe(true);
    expect(isValidCalendarDateString("2026-04-30")).toBe(true);
    expect(isValidCalendarDateString("2026-02-28")).toBe(true);
    // Anno bisestile
    expect(isValidCalendarDateString("2024-02-29")).toBe(true);
  });

  it("rifiuta date inesistenti (overflow di calendario)", () => {
    // 31 Aprile non esiste (aprile ha 30 giorni)
    expect(isValidCalendarDateString("2026-04-31")).toBe(false);
    // 31 Giugno non esiste (giugno ha 30 giorni)
    expect(isValidCalendarDateString("2026-06-31")).toBe(false);
    // 29 Febbraio in anno non bisestile
    expect(isValidCalendarDateString("2026-02-29")).toBe(false);
    // 31 Febbraio
    expect(isValidCalendarDateString("2026-02-31")).toBe(false);
    // Giorno o mese 0 o fuori range
    expect(isValidCalendarDateString("2026-00-15")).toBe(false);
    expect(isValidCalendarDateString("2026-13-01")).toBe(false);
    expect(isValidCalendarDateString("2026-01-00")).toBe(false);
    expect(isValidCalendarDateString("2026-01-32")).toBe(false);
  });

  it("rifiuta stringhe non conformi al formato AAAA-MM-GG", () => {
    expect(isValidCalendarDateString("")).toBe(false);
    expect(isValidCalendarDateString("31/04/2026")).toBe(false);
    expect(isValidCalendarDateString("2026-4-1")).toBe(false);
    expect(isValidCalendarDateString("invalid-date")).toBe(false);
  });
});

describe("parseDateInput", () => {
  it("effettua il parsing di date valide", () => {
    const d = parseDateInput("2026-04-30");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // 0-indexed: 3 = aprile
    expect(d.getDate()).toBe(30);
  });

  it("lancia eccezione su date inesistenti sul calendario", () => {
    expect(() => parseDateInput("2026-04-31")).toThrow("Data non valida sul calendario: 2026-04-31");
    expect(() => parseDateInput("2026-02-29")).toThrow("Data non valida sul calendario: 2026-02-29");
  });
});


