import { describe, expect, it } from "vitest";
import { parseInvoiceListQuery, invoiceFiltersSchema } from "./invoice-list-query";
import { EMPTY_INVOICE_FILTERS, currentMonthInvoiceFilters } from "@/components/invoices/invoice-filters";

const TODAY = new Date(2026, 6, 15); // 15 luglio 2026

describe("parseInvoiceListQuery", () => {
  it("nessun parametro: applica il default mese corrente e pagina 1", () => {
    const result = parseInvoiceListQuery({}, TODAY);
    expect(result.filters).toEqual(currentMonthInvoiceFilters(TODAY));
    expect(result.page).toBe(1);
  });

  it("f=1 con tutti i campi vuoti: filtri esplicitamente vuoti, NON il default mese corrente", () => {
    const result = parseInvoiceListQuery({ f: "1" }, TODAY);
    expect(result.filters).toEqual(EMPTY_INVOICE_FILTERS);
  });

  it("f=1 con anno impostato: filtri parsati letteralmente dall'URL", () => {
    const result = parseInvoiceListQuery({ f: "1", anno: "2024" }, TODAY);
    expect(result.filters).toEqual({ ...EMPTY_INVOICE_FILTERS, anno: "2024" });
  });

  it("modPag non valido con f=1: fallback all'intero oggetto default mese corrente", () => {
    const result = parseInvoiceListQuery({ f: "1", modPag: "PAYPAL" }, TODAY);
    expect(result.filters).toEqual(currentMonthInvoiceFilters(TODAY));
  });

  it("page assente: default 1", () => {
    expect(parseInvoiceListQuery({}, TODAY).page).toBe(1);
  });

  it("page valido: usato così com'è", () => {
    expect(parseInvoiceListQuery({ page: "3" }, TODAY).page).toBe(3);
  });

  it("page non numerico o <= 0: fallback a 1", () => {
    expect(parseInvoiceListQuery({ page: "abc" }, TODAY).page).toBe(1);
    expect(parseInvoiceListQuery({ page: "0" }, TODAY).page).toBe(1);
    expect(parseInvoiceListQuery({ page: "-3" }, TODAY).page).toBe(1);
  });

  it("valori ripetuti nell'URL (array): usa il primo", () => {
    const result = parseInvoiceListQuery({ f: "1", anno: ["2024", "2023"] }, TODAY);
    expect(result.filters.anno).toBe("2024");
  });
});

describe("invoiceFiltersSchema", () => {
  it("accetta i filtri vuoti", () => {
    expect(invoiceFiltersSchema.safeParse(EMPTY_INVOICE_FILTERS).success).toBe(true);
  });

  it("rifiuta una data malformata", () => {
    const result = invoiceFiltersSchema.safeParse({ ...EMPTY_INVOICE_FILTERS, dataDa: "15/07/2026" });
    expect(result.success).toBe(false);
  });

  it("rifiuta un modPag fuori enum", () => {
    const result = invoiceFiltersSchema.safeParse({ ...EMPTY_INVOICE_FILTERS, modPag: "PAYPAL" });
    expect(result.success).toBe(false);
  });
});
