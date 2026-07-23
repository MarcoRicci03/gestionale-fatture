import { describe, expect, it } from "vitest";
import {
  EMPTY_INVOICE_FILTERS,
  currentMonthInvoiceFilters,
} from "./invoice-filters";

describe("currentMonthInvoiceFilters", () => {
  it("mese a 31 giorni (luglio 2026)", () => {
    const result = currentMonthInvoiceFilters(new Date(2026, 6, 15));
    expect(result.dataDa).toBe("2026-07-01");
    expect(result.dataA).toBe("2026-07-31");
  });

  it("mese a 30 giorni (aprile 2026)", () => {
    const result = currentMonthInvoiceFilters(new Date(2026, 3, 10));
    expect(result.dataDa).toBe("2026-04-01");
    expect(result.dataA).toBe("2026-04-30");
  });

  it("febbraio non bisestile (2025)", () => {
    const result = currentMonthInvoiceFilters(new Date(2025, 1, 5));
    expect(result.dataDa).toBe("2025-02-01");
    expect(result.dataA).toBe("2025-02-28");
  });

  it("febbraio bisestile (2024)", () => {
    const result = currentMonthInvoiceFilters(new Date(2024, 1, 5));
    expect(result.dataDa).toBe("2024-02-01");
    expect(result.dataA).toBe("2024-02-29");
  });

  it("dicembre non sconfina nell'anno successivo", () => {
    const result = currentMonthInvoiceFilters(new Date(2026, 11, 20));
    expect(result.dataDa).toBe("2026-12-01");
    expect(result.dataA).toBe("2026-12-31");
  });

  it("gli altri campi restano stringa vuota come in EMPTY_INVOICE_FILTERS", () => {
    const result = currentMonthInvoiceFilters(new Date(2026, 6, 15));
    expect(result.persona).toBe(EMPTY_INVOICE_FILTERS.persona);
    expect(result.modPag).toBe(EMPTY_INVOICE_FILTERS.modPag);
    expect(result.anno).toBe(EMPTY_INVOICE_FILTERS.anno);
    expect(result.persona).toBe("");
    expect(result.modPag).toBe("");
    expect(result.anno).toBe("");
  });
});
