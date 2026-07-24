import { describe, it, expect } from "vitest";
import { payerSchema } from "../lib/validations/payer";

// cf/piva su payerSchema (lib/validations/payer.ts)
// accettavano qualunque stringa entro un limite di lunghezza ("abc" era un
// codice fiscale valido), a differenza di profileUpdateSchema che già usava
// le regex corrette. Questo test verifica che payerSchema ora usi le stesse
// regex (CF_REGEX/PIVA_REGEX, condivise da lib/constants/fiscal.ts), rifiuti
// formati non validi e normalizzi il CF in maiuscolo.

const basePayer = {
  nome: "Mario",
  cognome: "Rossi",
  via: "Via Roma 1",
  citta: "Roma",
  cap: "00100",
};

describe("cf", () => {
  it("rifiuta testo arbitrario troppo corto ('abc')", () => {
    expect(payerSchema.safeParse({ ...basePayer, cf: "abc" }).success).toBe(false);
  });
  it("rifiuta 16 caratteri con simboli non alfanumerici", () => {
    expect(payerSchema.safeParse({ ...basePayer, cf: "!".repeat(16) }).success).toBe(false);
  });
  it("accetta un cf valido in minuscolo e lo normalizza in maiuscolo", () => {
    const result = payerSchema.safeParse({ ...basePayer, cf: "rssmra80a01h501z" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cf).toBe("RSSMRA80A01H501Z");
  });
});

describe("piva", () => {
  it("rifiuta una piva non numerica ('abcdefghijk', 11 caratteri)", () => {
    expect(payerSchema.safeParse({ ...basePayer, piva: "abcdefghijk" }).success).toBe(false);
  });
  it("rifiuta una piva di sole 9 cifre", () => {
    expect(payerSchema.safeParse({ ...basePayer, piva: "123456789" }).success).toBe(false);
  });
  it("accetta una piva valida (11 cifre)", () => {
    expect(payerSchema.safeParse({ ...basePayer, piva: "12345678901" }).success).toBe(true);
  });
});
