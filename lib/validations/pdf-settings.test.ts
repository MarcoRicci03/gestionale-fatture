import { describe, it, expect } from "vitest";
import { bloccoSchema } from "./pdf-settings";

function makeBlocco(overrides: Partial<Parameters<typeof bloccoSchema.parse>[0]> = {}) {
  return {
    id: "b1",
    tipo: "testo" as const,
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    fontSize: 12,
    align: "left" as const,
    visible: true,
    ...overrides,
  };
}

describe("bloccoSchema lineHeight", () => {
  it("è opzionale: un blocco senza lineHeight resta valido", () => {
    const result = bloccoSchema.safeParse(makeBlocco());
    expect(result.success).toBe(true);
  });

  it("accetta un valore nel range [0.5, 3]", () => {
    const result = bloccoSchema.safeParse(makeBlocco({ lineHeight: 1.5 }));
    expect(result.success).toBe(true);
  });

  it("rifiuta un valore sotto 0.5", () => {
    const result = bloccoSchema.safeParse(makeBlocco({ lineHeight: 0.4 }));
    expect(result.success).toBe(false);
  });

  it("rifiuta un valore sopra 3", () => {
    const result = bloccoSchema.safeParse(makeBlocco({ lineHeight: 3.1 }));
    expect(result.success).toBe(false);
  });
});
