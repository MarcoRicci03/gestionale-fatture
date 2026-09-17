import { describe, expect, it } from "vitest";
import { validateCodiceFiscale } from "./cf-validator";

describe("cf-validator — validazione formale e CIN", () => {
  it("valida codici fiscali italiani validi", () => {
    // Codici fiscali reali con CIN corretto
    expect(validateCodiceFiscale("RSSMRA85M01H501Q").valid).toBe(true);
    expect(validateCodiceFiscale("BNCLGI75C12F205E").valid).toBe(true);
    expect(validateCodiceFiscale("rssmra85m01h501q").valid).toBe(true); // case-insensitive
  });

  it("rifiuta stringhe con CIN errato", () => {
    // Ultimo carattere cambiato da Q a Z
    const res = validateCodiceFiscale("RSSMRA85M01H501Z");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("CIN");
  });

  it("rifiuta stringhe con lunghezza non valida o formato errato", () => {
    expect(validateCodiceFiscale("").valid).toBe(false);
    expect(validateCodiceFiscale(null).valid).toBe(false);
    expect(validateCodiceFiscale("SHORT").valid).toBe(false);
    expect(validateCodiceFiscale("1234567890123456").valid).toBe(false);
  });
});
