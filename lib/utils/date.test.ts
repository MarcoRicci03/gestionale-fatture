import { describe, expect, it } from "vitest";
import { maskDateInput } from "./date";

describe("maskDateInput", () => {
  it("aggiunge lo slash automaticamente dopo 2 cifre del giorno", () => {
    expect(maskDateInput("0", "")).toBe("0");
    expect(maskDateInput("01", "0")).toBe("01/");
  });

  it("aggiunge lo slash automaticamente dopo 2 cifre del mese", () => {
    expect(maskDateInput("01/0", "01/")).toBe("01/0");
    expect(maskDateInput("01/03", "01/0")).toBe("01/03/");
  });

  it("completa la data con l'anno a 4 cifre", () => {
    expect(maskDateInput("01/03/2", "01/03/")).toBe("01/03/2");
    expect(maskDateInput("01/03/2026", "01/03/202")).toBe("01/03/2026");
  });

  it("gestisce il Backspace su slash finale senza bloccarsi", () => {
    expect(maskDateInput("01", "01/")).toBe("0");
    expect(maskDateInput("01/03", "01/03/")).toBe("01/0");
  });

  it("gestisce l'inserimento manuale dello slash con padding a 2 cifre", () => {
    expect(maskDateInput("1/", "")).toBe("01/");
    expect(maskDateInput("01/3/", "01/3")).toBe("01/03/");
  });

  it("gestisce incolla di formato DD/MM/YYYY e DD-MM-YYYY", () => {
    expect(maskDateInput("01/03/2026", "")).toBe("01/03/2026");
    expect(maskDateInput("01-03-2026", "")).toBe("01/03/2026");
    expect(maskDateInput("1/3/2026", "")).toBe("01/03/2026");
  });

  it("gestisce incolla di formato ISO YYYY-MM-DD", () => {
    expect(maskDateInput("2026-03-01", "")).toBe("01/03/2026");
  });

  it("gestisce stringhe vuote", () => {
    expect(maskDateInput("", "01/")).toBe("");
  });
});
