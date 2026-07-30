import { describe, expect, it } from "vitest";
import { lastValidPage, pageSchema } from "./pagination";

describe("lastValidPage", () => {
  it("0 risultati: pagina 1 (mai 0)", () => {
    expect(lastValidPage(0, 25)).toBe(1);
  });

  it("risultati che riempiono esattamente una pagina: resta 1", () => {
    expect(lastValidPage(25, 25)).toBe(1);
  });

  it("un risultato in più dell'ultima pagina piena: arrotonda per eccesso", () => {
    expect(lastValidPage(26, 25)).toBe(2);
  });

  it("più pagine piene: divisione esatta", () => {
    expect(lastValidPage(100, 25)).toBe(4);
  });
});

describe("pageSchema", () => {
  it("accetta un intero positivo", () => {
    expect(pageSchema.safeParse("3").success).toBe(true);
  });

  it("rifiuta 0 e i negativi", () => {
    expect(pageSchema.safeParse("0").success).toBe(false);
    expect(pageSchema.safeParse("-3").success).toBe(false);
  });

  it("rifiuta valori non numerici", () => {
    expect(pageSchema.safeParse("abc").success).toBe(false);
  });

  it("accetta il limite superiore (1_000_000)", () => {
    expect(pageSchema.safeParse("1000000").success).toBe(true);
  });

  it("rifiuta oltre il limite superiore, anche per valori enormi da URL manomesso", () => {
    expect(pageSchema.safeParse("1000001").success).toBe(false);
    expect(pageSchema.safeParse("100000000000000000000").success).toBe(false);
  });
});
