import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { serializeInvoiceNumbers } from "./serialize";

describe("serializeInvoiceNumbers (DRY-03)", () => {
  it("converte Decimal in number per prezzo_totale, bollo e mesi", () => {
    const raw = {
      id: 1,
      numero: 10,
      prezzo_totale: new Prisma.Decimal("150.50"),
      bollo: new Prisma.Decimal("2.00"),
      mesi: [
        { id: 101, prezzo: new Prisma.Decimal("100.00"), descrizione: "Visita" },
        { id: 102, prezzo: new Prisma.Decimal("50.50"), descrizione: "Controllo" },
      ],
    };

    const serialized = serializeInvoiceNumbers(raw);

    expect(typeof serialized.prezzo_totale).toBe("number");
    expect(serialized.prezzo_totale).toBe(150.5);
    expect(typeof serialized.bollo).toBe("number");
    expect(serialized.bollo).toBe(2);
    expect(serialized.mesi).toHaveLength(2);
    expect(typeof serialized.mesi[0].prezzo).toBe("number");
    expect(serialized.mesi[0].prezzo).toBe(100);
    expect(serialized.mesi[1].prezzo).toBe(50.5);
  });

  it("gestisce bollo nullo o undefined impostando 0", () => {
    const raw = {
      id: 2,
      prezzo_totale: new Prisma.Decimal("50.00"),
      bollo: null,
      mesi: [],
    };

    const serialized = serializeInvoiceNumbers(raw);
    expect(serialized.bollo).toBe(0);
  });

  it("gestisce input già serializzati in number (idempotente)", () => {
    const raw = {
      id: 3,
      prezzo_totale: 80,
      bollo: 2,
      mesi: [{ id: 103, prezzo: 80 }],
    };

    const serialized = serializeInvoiceNumbers(raw);
    expect(serialized.prezzo_totale).toBe(80);
    expect(serialized.bollo).toBe(2);
    expect(serialized.mesi[0].prezzo).toBe(80);
  });
});
