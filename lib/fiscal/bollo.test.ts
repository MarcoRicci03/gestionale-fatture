import { describe, it, expect } from "vitest";
import {
  calcolaTotaliFattura,
  getBolloImporto,
  getTotaleConBollo,
  isBolloApplicato,
  isBolloCodiceValido,
  isBolloDovuto,
  SOGLIA_BOLLO,
  IMPORTO_BOLLO,
} from "./bollo";

describe("lib/fiscal/bollo", () => {
  describe("isBolloDovuto", () => {
    it("è false per importi inferiori o uguali a 77.47 €", () => {
      expect(isBolloDovuto(0)).toBe(false);
      expect(isBolloDovuto(50)).toBe(false);
      expect(isBolloDovuto(SOGLIA_BOLLO)).toBe(false);
    });

    it("è true per importi strettamente superiori a 77.47 €", () => {
      expect(isBolloDovuto(SOGLIA_BOLLO + 0.01)).toBe(true);
      expect(isBolloDovuto(100)).toBe(true);
    });
  });

  describe("isBolloApplicato", () => {
    it("è false per valori null, undefined, vuoti o soli spazi", () => {
      expect(isBolloApplicato(null)).toBe(false);
      expect(isBolloApplicato(undefined)).toBe(false);
      expect(isBolloApplicato("")).toBe(false);
      expect(isBolloApplicato("   ")).toBe(false);
    });

    it("è true se è presente una stringa non vuota", () => {
      expect(isBolloApplicato("12345678901234")).toBe(true);
    });
  });

  describe("isBolloCodiceValido", () => {
    it("rifiuta valori nulli, vuoti o formati non a 14 cifre", () => {
      expect(isBolloCodiceValido(null)).toBe(false);
      expect(isBolloCodiceValido("")).toBe(false);
      expect(isBolloCodiceValido("12345")).toBe(false);
      expect(isBolloCodiceValido("1234567890123a")).toBe(false);
    });

    it("accetta codici numerici validi a 14 cifre", () => {
      expect(isBolloCodiceValido("12345678901234")).toBe(true);
      expect(isBolloCodiceValido(" 12345678901234 ")).toBe(true);
    });
  });

  describe("calcolaTotaliFattura", () => {
    it("calcola correttamente per importo sotto soglia senza bollo", () => {
      const res = calcolaTotaliFattura(50, null);
      expect(res).toEqual({
        prezzoTotale: 50,
        bolloImporto: 0,
        totaleConBollo: 50,
        bolloDovuto: false,
        bolloApplicato: false,
        bolloMancante: false,
      });
    });

    it("calcola correttamente per importo sopra soglia con codice bollo", () => {
      const res = calcolaTotaliFattura(100, "12345678901234");
      expect(res).toEqual({
        prezzoTotale: 100,
        bolloImporto: IMPORTO_BOLLO,
        totaleConBollo: 102,
        bolloDovuto: true,
        bolloApplicato: true,
        bolloMancante: false,
      });
    });

    it("segnala bolloMancante se importo sopra soglia ma privo di codice", () => {
      const res = calcolaTotaliFattura(100, null);
      expect(res).toEqual({
        prezzoTotale: 100,
        bolloImporto: 0,
        totaleConBollo: 100,
        bolloDovuto: true,
        bolloApplicato: false,
        bolloMancante: true,
      });
    });

    it("supporta bollo applicato anche sotto soglia se codice fornito", () => {
      const res = calcolaTotaliFattura(40, "12345678901234");
      expect(res).toEqual({
        prezzoTotale: 40,
        bolloImporto: IMPORTO_BOLLO,
        totaleConBollo: 42,
        bolloDovuto: false,
        bolloApplicato: true,
        bolloMancante: false,
      });
    });

    it("gestisce arrotondamento float senza problemi di virgola mobile", () => {
      const res = calcolaTotaliFattura(77.48, "12345678901234");
      expect(res.totaleConBollo).toBe(79.48);
    });
  });

  describe("retrocompatibilità getBolloImporto e getTotaleConBollo", () => {
    it("getBolloImporto restituisce 2 o 0", () => {
      expect(getBolloImporto(null)).toBe(0);
      expect(getBolloImporto("12345678901234")).toBe(2);
    });

    it("getTotaleConBollo calcola la somma corretta", () => {
      expect(getTotaleConBollo(100, null)).toBe(100);
      expect(getTotaleConBollo(100, "12345678901234")).toBe(102);
    });
  });
});
