import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatArchiveInvoiceImpact,
  getHardDeleteInvoiceBlockReason,
  getHardDeletePatientsBlockReason,
} from "./formatting";

describe("lib/archive/formatting (DRY-01)", () => {
  describe("formatCurrency", () => {
    it("formatta l'importo in Euro italiano", () => {
      const formatted = formatCurrency(1250.5);
      expect(formatted).toMatch(/(?:1\.250|1250),50\s*€/);
    });
  });

  describe("formatArchiveInvoiceImpact", () => {
    it("restituisce null se count è 0", () => {
      expect(
        formatArchiveInvoiceImpact({
          count: 0,
          totale: 0,
          annoMin: null,
          annoMax: null,
        })
      ).toBeNull();
    });

    it("formatta correttamente 1 fattura con anno singolo", () => {
      const result = formatArchiveInvoiceImpact({
        count: 1,
        totale: 100,
        annoMin: 2025,
        annoMax: 2025,
      });
      expect(result).toMatch(/1 fattura collegata \(2025,\s*100,00\s*€\)/);
    });

    it("formatta correttamente più fatture con intervallo di anni", () => {
      const result = formatArchiveInvoiceImpact({
        count: 5,
        totale: 550.2,
        annoMin: 2023,
        annoMax: 2025,
      });
      expect(result).toMatch(/5 fatture collegate \(2023-2025,\s*550,20\s*€\)/);
    });
  });

  describe("getHardDeleteInvoiceBlockReason", () => {
    it("restituisce null se count è <= 0", () => {
      expect(getHardDeleteInvoiceBlockReason(0)).toBeNull();
      expect(getHardDeleteInvoiceBlockReason(-1)).toBeNull();
    });

    it("formatta il motivo di blocco per 1 fattura", () => {
      expect(getHardDeleteInvoiceBlockReason(1)).toBe(
        "Impossibile eliminare: ci sono 1 fattura collegata. Le fatture non possono essere cancellate."
      );
    });

    it("formatta il motivo di blocco per più fatture", () => {
      expect(getHardDeleteInvoiceBlockReason(3)).toBe(
        "Impossibile eliminare: ci sono 3 fatture collegate. Le fatture non possono essere cancellate."
      );
    });
  });

  describe("getHardDeletePatientsBlockReason", () => {
    it("restituisce null se count è <= 0", () => {
      expect(getHardDeletePatientsBlockReason(0)).toBeNull();
    });

    it("formatta il motivo di blocco per 1 paziente non archiviato", () => {
      expect(getHardDeletePatientsBlockReason(1)).toBe(
        "Impossibile eliminare: 1 paziente collegato non è ancora archiviato. Archivialo prima di procedere."
      );
    });

    it("formatta il motivo di blocco per più pazienti non archiviati", () => {
      expect(getHardDeletePatientsBlockReason(2)).toBe(
        "Impossibile eliminare: 2 pazienti collegati non sono ancora archiviati. Archivialo prima di procedere."
      );
    });
  });
});
