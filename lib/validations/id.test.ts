import { describe, it, expect } from "vitest";
import { isValidId } from "./id";

// Number.isNaN da solo non basta: Number("Infinity") -> Infinity (non NaN,
// non intero), Number("1e12") -> un intero fuori dal range int4 di Postgres.
// In entrambi i casi Prisma lanciava un'eccezione non catturata e il client
// riceveva un 500 generico invece del 400 corretto (LOG-08).
describe("isValidId", () => {
  it("accetta un intero positivo valido", () => {
    expect(isValidId(Number("42"))).toBe(true);
  });

  it("rifiuta NaN", () => {
    expect(isValidId(Number("abc"))).toBe(false);
  });

  it("rifiuta Infinity", () => {
    expect(isValidId(Number("Infinity"))).toBe(false);
  });

  it("rifiuta un numero fuori dal range int4 di Postgres", () => {
    expect(isValidId(Number("1e12"))).toBe(false);
  });

  it("rifiuta zero e i negativi", () => {
    expect(isValidId(0)).toBe(false);
    expect(isValidId(-1)).toBe(false);
  });

  it("rifiuta un decimale non intero", () => {
    expect(isValidId(Number("1.5"))).toBe(false);
  });

  it("accetta il limite superiore int4", () => {
    expect(isValidId(2_147_483_647)).toBe(true);
  });

  it("rifiuta un valore appena oltre il limite superiore int4", () => {
    expect(isValidId(2_147_483_648)).toBe(false);
  });

  it("rifiuta valori non numerici passati come argomento RPC (P016)", () => {
    expect(isValidId("42")).toBe(false);
    expect(isValidId(null)).toBe(false);
    expect(isValidId({ id: 1 })).toBe(false);
  });
});
