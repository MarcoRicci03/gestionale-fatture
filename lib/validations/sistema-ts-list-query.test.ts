import { describe, it, expect } from "vitest";
import { parseSistemaTsListQuery } from "./sistema-ts-list-query";

describe("parseSistemaTsListQuery (P011)", () => {
  it("accetta date di calendario valide e gli stati noti", () => {
    expect(
      parseSistemaTsListQuery({ dateFrom: "2026-01-01", dateTo: "2026-02-28", stato: "INVIATA" })
    ).toEqual({ dateFrom: "2026-01-01", dateTo: "2026-02-28", stato: "INVIATA" });
    expect(parseSistemaTsListQuery({ stato: "ALL" }).stato).toBe("ALL");
  });

  it("scarta date non valide o inesistenti e stati sconosciuti", () => {
    expect(
      parseSistemaTsListQuery({ dateFrom: "abc", dateTo: "2026-02-31", stato: "FOO" })
    ).toEqual({ dateFrom: undefined, dateTo: undefined, stato: undefined });
  });

  it("usa il primo valore se il parametro è ripetuto e tollera l'assenza", () => {
    expect(parseSistemaTsListQuery({ stato: ["DA_INVIARE", "INVIATA"] }).stato).toBe("DA_INVIARE");
    expect(parseSistemaTsListQuery({})).toEqual({
      dateFrom: undefined,
      dateTo: undefined,
      stato: undefined,
    });
  });
});
