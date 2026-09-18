import { describe, it, expect } from "vitest";
import {
  buildVociSpesa,
  resolveNaturaIvaBollo,
  validateImportoSpesa,
  SISTEMATS_IMPORTO_MIN,
  SISTEMATS_IMPORTO_MAX,
} from "./payload-builder";
import { SOGLIA_BOLLO, IMPORTO_BOLLO } from "@/lib/constants/bollo";

describe("payload-builder — validateImportoSpesa", () => {
  it("valida con successo importi compresi tra 0.01 e 99999.99", () => {
    expect(validateImportoSpesa(0.01)).toEqual({ valid: true });
    expect(validateImportoSpesa(50.0)).toEqual({ valid: true });
    expect(validateImportoSpesa(77.47)).toEqual({ valid: true });
    expect(validateImportoSpesa(1200.5)).toEqual({ valid: true });
    expect(validateImportoSpesa(SISTEMATS_IMPORTO_MAX)).toEqual({ valid: true });
  });

  it("rifiuta importi inferiori a 0.01 € (incluso 0.00 € e negativi)", () => {
    const resZero = validateImportoSpesa(0);
    expect(resZero.valid).toBe(false);
    expect(resZero.error).toContain("maggiore di zero");

    const resNegativo = validateImportoSpesa(-15.5);
    expect(resNegativo.valid).toBe(false);
    expect(resNegativo.error).toContain("maggiore di zero");

    const resQuasiZero = validateImportoSpesa(0.009);
    expect(resQuasiZero.valid).toBe(false);
    expect(resQuasiZero.error).toContain("minimo 0,01 €");
  });

  it("rifiuta importi superiori al limite XSD (99.999,99 €)", () => {
    const resOver = validateImportoSpesa(100000.0);
    expect(resOver.valid).toBe(false);
    expect(resOver.error).toContain("supera il limite massimo");
  });

  it("rifiuta valori null, undefined o NaN", () => {
    expect(validateImportoSpesa(null).valid).toBe(false);
    expect(validateImportoSpesa(undefined).valid).toBe(false);
    expect(validateImportoSpesa(NaN).valid).toBe(false);
  });
});

describe("payload-builder — resolveNaturaIvaBollo", () => {
  it("restituisce N1 se la fattura è in regime ordinario esente art. 10 (N4)", () => {
    expect(resolveNaturaIvaBollo("N4")).toBe("N1");
  });

  it("restituisce N2.2 per regime forfettario (N2.2 ex interpello AdE 428/2022)", () => {
    expect(resolveNaturaIvaBollo("N2.2")).toBe("N2.2");
  });

  it("restituisce N2.2 come fallback se naturaIva è assente o vuota", () => {
    expect(resolveNaturaIvaBollo(null)).toBe("N2.2");
    expect(resolveNaturaIvaBollo(undefined)).toBe("N2.2");
    expect(resolveNaturaIvaBollo("")).toBe("N2.2");
  });
});

describe("payload-builder — buildVociSpesa", () => {
  it("costruisce una sola voce spesa con SP se importo <= 77.47 e senza bolloCodice", () => {
    const voci = buildVociSpesa({
      prezzoTotale: 50,
      naturaIva: "N2.2",
    });

    expect(voci).toHaveLength(1);
    expect(voci[0]).toEqual({
      tipoSpesa: "SP",
      importo: 50,
      naturaIva: "N2.2",
    });
  });

  it("esclude il bollo se importo esattamente pari alla soglia (77.47) e senza bolloCodice", () => {
    const voci = buildVociSpesa({
      prezzoTotale: SOGLIA_BOLLO,
      naturaIva: "N4",
    });

    expect(voci).toHaveLength(1);
    expect(voci[0]).toEqual({
      tipoSpesa: "SP",
      importo: SOGLIA_BOLLO,
      naturaIva: "N4",
    });
  });

  it("aggiunge riga bollo con natura N2.2 per forfettari quando importo > 77.47", () => {
    const voci = buildVociSpesa({
      prezzoTotale: 100,
      naturaIva: "N2.2",
    });

    expect(voci).toHaveLength(2);
    expect(voci[0]).toEqual({
      tipoSpesa: "SP",
      importo: 100,
      naturaIva: "N2.2",
    });
    expect(voci[1]).toEqual({
      tipoSpesa: "SP",
      importo: IMPORTO_BOLLO,
      naturaIva: "N2.2",
    });
  });

  it("aggiunge riga bollo con natura N1 per regime ordinario esente art. 10 (N4) quando importo > 77.47", () => {
    const voci = buildVociSpesa({
      prezzoTotale: 150,
      naturaIva: "N4",
    });

    expect(voci).toHaveLength(2);
    expect(voci[0]).toEqual({
      tipoSpesa: "SP",
      importo: 150,
      naturaIva: "N4",
    });
    expect(voci[1]).toEqual({
      tipoSpesa: "SP",
      importo: IMPORTO_BOLLO,
      naturaIva: "N1",
    });
  });

  it("aggiunge riga bollo anche sotto soglia (es. 40 €) se bolloCodice è presente", () => {
    const voci = buildVociSpesa({
      prezzoTotale: 40,
      naturaIva: "N2.2",
      bolloCodice: "01202600001234",
    });

    expect(voci).toHaveLength(2);
    expect(voci[0].importo).toBe(40);
    expect(voci[1]).toEqual({
      tipoSpesa: "SP",
      importo: IMPORTO_BOLLO,
      naturaIva: "N2.2",
    });
  });

  it("aggiunge riga bollo sotto soglia con natura N1 per regime ordinario se bolloCodice è presente", () => {
    const voci = buildVociSpesa({
      prezzoTotale: 30,
      naturaIva: "N4",
      bolloCodice: "01202600001234",
    });

    expect(voci).toHaveLength(2);
    expect(voci[1]).toEqual({
      tipoSpesa: "SP",
      importo: IMPORTO_BOLLO,
      naturaIva: "N1",
    });
  });
});
