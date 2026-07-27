import { describe, it, expect } from "vitest";
import { isValidInvoiceId } from "./invoice-id";

// Number.isNaN da solo non basta: Number("Infinity") -> Infinity (non NaN,
// non intero), Number("1e12") -> un intero fuori dal range int4 di Postgres.
// In entrambi i casi Prisma lanciava un'eccezione non catturata e il client
// riceveva un 500 generico invece del 400 corretto (LOG-08).
describe("isValidInvoiceId", () => {
  it("accetta un intero positivo valido", () => {
    expect(isValidInvoiceId(Number("42"))).toBe(true);
  });

  it("rifiuta NaN", () => {
    expect(isValidInvoiceId(Number("abc"))).toBe(false);
  });

  it("rifiuta Infinity", () => {
    expect(isValidInvoiceId(Number("Infinity"))).toBe(false);
  });

  it("rifiuta un numero fuori dal range int4 di Postgres", () => {
    expect(isValidInvoiceId(Number("1e12"))).toBe(false);
  });

  it("rifiuta zero e i negativi", () => {
    expect(isValidInvoiceId(0)).toBe(false);
    expect(isValidInvoiceId(-1)).toBe(false);
  });

  it("rifiuta un decimale non intero", () => {
    expect(isValidInvoiceId(Number("1.5"))).toBe(false);
  });

  it("accetta il limite superiore int4", () => {
    expect(isValidInvoiceId(2_147_483_647)).toBe(true);
  });

  it("rifiuta un valore appena oltre il limite superiore int4", () => {
    expect(isValidInvoiceId(2_147_483_648)).toBe(false);
  });
});
