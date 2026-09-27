import { describe, expect, it } from "vitest";
import {
  calculatePagination,
  clampPage,
  lastValidPage,
  pageSchema,
  parsePageSize,
} from "./pagination";


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

describe("parsePageSize", () => {
  it("valori ammessi restituiscono il numero corrispondente", () => {
    expect(parsePageSize("10")).toBe(10);
    expect(parsePageSize(20)).toBe(20);
    expect(parsePageSize("25")).toBe(25);
    expect(parsePageSize(50)).toBe(50);
  });

  it("valori null/undefined/vuoti usano il fallback", () => {
    expect(parsePageSize(undefined)).toBe(25);
    expect(parsePageSize(null)).toBe(25);
    expect(parsePageSize("")).toBe(25);
    expect(parsePageSize(undefined, 10)).toBe(10);
  });

  it("valori non ammessi usano il fallback", () => {
    expect(parsePageSize("15")).toBe(25);
    expect(parsePageSize("invalid")).toBe(25);
    expect(parsePageSize(-10)).toBe(25);
    expect(parsePageSize(999, 20)).toBe(20);
  });
});

describe("calculatePagination", () => {
  it("calcola skip e take corretti con valori standard e default", () => {
    const res1 = calculatePagination(1);
    expect(res1).toEqual({ page: 1, pageSize: 25, skip: 0, take: 25 });

    const res2 = calculatePagination(2, 10);
    expect(res2).toEqual({ page: 2, pageSize: 10, skip: 10, take: 10 });

    const res3 = calculatePagination(5, 50);
    expect(res3).toEqual({ page: 5, pageSize: 50, skip: 200, take: 50 });
  });

  it("protegge contro valori minori o uguali a 0 di page", () => {
    expect(calculatePagination(0, 25)).toEqual({ page: 1, pageSize: 25, skip: 0, take: 25 });
    expect(calculatePagination(-5, 25)).toEqual({ page: 1, pageSize: 25, skip: 0, take: 25 });
  });

  it("gestisce input decimali o NaN per page", () => {
    expect(calculatePagination(2.9, 25)).toEqual({ page: 2, pageSize: 25, skip: 25, take: 25 });
    expect(calculatePagination(NaN, 25)).toEqual({ page: 1, pageSize: 25, skip: 0, take: 25 });
  });

  it("gestisce pageSize non validi o negativi usando il fallback", () => {
    expect(calculatePagination(1, 0)).toEqual({ page: 1, pageSize: 25, skip: 0, take: 25 });
    expect(calculatePagination(1, -10)).toEqual({ page: 1, pageSize: 25, skip: 0, take: 25 });
    expect(calculatePagination(1, NaN)).toEqual({ page: 1, pageSize: 25, skip: 0, take: 25 });
  });
});

describe("clampPage", () => {
  it("mantiene page se rientra nell'intervallo consentito", () => {
    expect(clampPage(2, 100, 25)).toBe(2);
    expect(clampPage(4, 100, 25)).toBe(4);
  });

  it("limita page alla pagina massima consentita quando eccede", () => {
    expect(clampPage(10, 50, 25)).toBe(2);
    expect(clampPage(99, 1, 25)).toBe(1);
  });

  it("limita page ad almeno 1 per valori <= 0", () => {
    expect(clampPage(0, 100, 25)).toBe(1);
    expect(clampPage(-5, 100, 25)).toBe(1);
  });

  it("restituisce pagina 1 quando totalCount è 0", () => {
    expect(clampPage(5, 0, 25)).toBe(1);
  });

  it("arrotonda numeri decimali per page", () => {
    expect(clampPage(2.8, 100, 25)).toBe(2);
  });
});
