import { describe, expect, it } from "vitest";
import { invoiceExportSchema, MAX_EXPORT_INVOICES } from "./invoice-export";
import { EMPTY_INVOICE_FILTERS } from "@/components/invoices/invoice-filters";

describe("invoiceExportSchema - ramo ids", () => {
  it("accetta ids validi", () => {
    const result = invoiceExportSchema.safeParse({ ids: [1, 2, 3], columns: ["n_fattura"] });
    expect(result.success).toBe(true);
  });

  it("rifiuta più di MAX_EXPORT_INVOICES ids", () => {
    const ids = Array.from({ length: MAX_EXPORT_INVOICES + 1 }, (_, i) => i + 1);
    const result = invoiceExportSchema.safeParse({ ids, columns: ["n_fattura"] });
    expect(result.success).toBe(false);
  });
});

describe("invoiceExportSchema - ramo filters", () => {
  it("accetta filtri validi", () => {
    const result = invoiceExportSchema.safeParse({
      filters: { ...EMPTY_INVOICE_FILTERS, anno: "2025" },
      columns: ["n_fattura"],
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta filtri malformati (data non valida)", () => {
    const result = invoiceExportSchema.safeParse({
      filters: { ...EMPTY_INVOICE_FILTERS, dataDa: "non-una-data" },
      columns: ["n_fattura"],
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un body senza né ids né filters", () => {
    const result = invoiceExportSchema.safeParse({ columns: ["n_fattura"] });
    expect(result.success).toBe(false);
  });
});
