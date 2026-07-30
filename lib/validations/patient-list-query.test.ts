import { describe, expect, it } from "vitest";
import { parsePatientListQuery } from "./patient-list-query";

describe("parsePatientListQuery", () => {
  it("nessun parametro: ricerca vuota, entrambe le pagine a 1", () => {
    expect(parsePatientListQuery({})).toEqual({
      search: "",
      page: 1,
      archivedPage: 1,
    });
  });

  it("q impostato: usato così com'è", () => {
    expect(parsePatientListQuery({ q: "Rossi" }).search).toBe("Rossi");
  });

  it("q oltre 200 caratteri: fallback a ricerca vuota", () => {
    const tooLong = "a".repeat(201);
    expect(parsePatientListQuery({ q: tooLong }).search).toBe("");
  });

  it("page e archivedPage indipendenti", () => {
    const result = parsePatientListQuery({ page: "2", archivedPage: "5" });
    expect(result.page).toBe(2);
    expect(result.archivedPage).toBe(5);
  });

  it("page non numerico o <= 0: fallback a 1", () => {
    expect(parsePatientListQuery({ page: "abc" }).page).toBe(1);
    expect(parsePatientListQuery({ page: "0" }).page).toBe(1);
    expect(parsePatientListQuery({ page: "-3" }).page).toBe(1);
  });

  it("page assurdamente grande (URL manomesso): fallback a 1", () => {
    expect(
      parsePatientListQuery({ page: "100000000000000000000" }).page
    ).toBe(1);
  });

  it("valori ripetuti nell'URL (array): usa il primo", () => {
    expect(parsePatientListQuery({ q: ["Rossi", "Bianchi"] }).search).toBe(
      "Rossi"
    );
  });
});
