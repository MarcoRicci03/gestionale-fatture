import { describe, expect, it } from "vitest";
import { getBolloImporto, getTotaleConBollo } from "./bollo-total";

describe("getBolloImporto", () => {
  it("bolloCodice presente: 2,00€", () => {
    expect(getBolloImporto("01234567890123")).toBe(2);
  });

  it("bolloCodice null: 0", () => {
    expect(getBolloImporto(null)).toBe(0);
  });

  it("bolloCodice undefined: 0", () => {
    expect(getBolloImporto(undefined)).toBe(0);
  });

  it("bolloCodice stringa vuota (stato form non ancora compilato): 0", () => {
    expect(getBolloImporto("")).toBe(0);
  });
});

describe("getTotaleConBollo", () => {
  it("bolloCodice presente: somma prezzoTotale + 2,00€", () => {
    expect(getTotaleConBollo(100, "01234567890123")).toBe(102);
  });

  it("bolloCodice assente: resta prezzoTotale invariato", () => {
    expect(getTotaleConBollo(100, null)).toBe(100);
    expect(getTotaleConBollo(100, "")).toBe(100);
  });
});
