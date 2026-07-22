import { it, expect, beforeAll } from "vitest";

// Regressione SEC-03: con HS256 chiunque conosca JWT_SECRET può forgiare un
// token di sessione valido per QUALSIASI utente (basta impostare `sub` a
// piacere). lib/auth/jwt.ts deve rifiutare un segreto corto o un valore
// segnaposto noto (es. "change-me"), non limitarsi a verificarne la
// presenza.
//
// JWT_SECRET va impostato PRIMA di importare lib/auth/jwt.ts (che lo legge e
// valida al caricamento del modulo): import dinamico in beforeAll, dopo aver
// valorizzato process.env.JWT_SECRET con un segreto valido, così il modulo si
// carica una volta sola e assertStrongJwtSecret può poi essere richiamata
// direttamente con altri valori, senza dover far ripartire il processo.

let assertStrongJwtSecret: (value: string) => void;

beforeAll(async () => {
  process.env.JWT_SECRET ??= "verify-script-test-secret-please-ignore-0000000000";
  ({ assertStrongJwtSecret } = await import("../lib/auth/jwt"));
});

it('rifiuta un valore segnaposto noto ("change-me")', () => {
  expect(() => assertStrongJwtSecret("change-me")).toThrow();
});

it("il controllo sui segnaposto ignora maiuscole/minuscole", () => {
  expect(() => assertStrongJwtSecret("CHANGE-ME")).toThrow();
});

it("rifiuta un segreto più corto di 32 byte", () => {
  expect(() => assertStrongJwtSecret("short-secret-1234")).toThrow();
});

it("rifiuta una stringa vuota", () => {
  expect(() => assertStrongJwtSecret("")).toThrow();
});

it("accetta un segreto lungo e non segnaposto", () => {
  expect(() =>
    assertStrongJwtSecret("a-very-long-randomly-generated-secret-1234567890")
  ).not.toThrow();
});
