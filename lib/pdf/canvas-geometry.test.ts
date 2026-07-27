import { describe, expect, it } from "vitest";
import { PAGE_W, PAGE_H, SNAP_THRESHOLD, clamp, toNumber, computeSnap } from "./canvas-geometry";
import type { Blocco } from "./types";

function makeBlocco(overrides: Partial<Blocco> & Pick<Blocco, "id" | "x" | "y" | "width" | "height">): Blocco {
  return {
    tipo: "testo",
    fontSize: 12,
    align: "left",
    visible: true,
    ...overrides,
  };
}

describe("clamp", () => {
  it("lascia invariato un valore già nel range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("porta a min un valore sotto range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("porta a max un valore sopra range", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("toNumber", () => {
  it("converte una stringa numerica", () => {
    expect(toNumber("42")).toBe(42);
  });
  it("restituisce 0 per una stringa non numerica (invece di NaN)", () => {
    expect(toNumber("abc")).toBe(0);
  });
  it("restituisce 0 per una stringa vuota", () => {
    expect(toNumber("")).toBe(0);
  });
});

describe("computeSnap", () => {
  it("aggancia il bordo sinistro del blocco trascinato al bordo sinistro di un vicino entro SNAP_THRESHOLD", () => {
    const dragged = makeBlocco({ id: "a", x: 103, y: 200, width: 100, height: 50 });
    const other = makeBlocco({ id: "b", x: 100, y: 500, width: 100, height: 50 });
    const result = computeSnap(dragged, 103, 200, [other]);
    expect(result).toEqual({ x: 100, y: 200, guides: { x: 100 } });
  });

  it("aggancia l'asse Y allo stesso modo, indipendentemente dall'asse X", () => {
    const dragged = makeBlocco({ id: "a", x: 300, y: 203, width: 100, height: 50 });
    const other = makeBlocco({ id: "b", x: 0, y: 200, width: 40, height: 50 });
    const result = computeSnap(dragged, 300, 203, [other]);
    expect(result).toEqual({ x: 300, y: 200, guides: { y: 200 } });
  });

  it("non aggancia se la distanza supera SNAP_THRESHOLD", () => {
    const dragged = makeBlocco({ id: "a", x: 120, y: 200, width: 100, height: 50 });
    const other = makeBlocco({ id: "b", x: 100, y: 500, width: 100, height: 50 });
    const result = computeSnap(dragged, 120, 200, [other]);
    expect(result).toEqual({ x: 120, y: 200, guides: {} });
  });

  it("ignora il blocco stesso tra i candidati (self-snap)", () => {
    const dragged = makeBlocco({ id: "a", x: 103, y: 200, width: 100, height: 50 });
    const result = computeSnap(dragged, 103, 200, [dragged]);
    expect(result).toEqual({ x: 103, y: 200, guides: {} });
  });

  it("clampa il risultato agganciato dentro i limiti della pagina", () => {
    const dragged = makeBlocco({ id: "a", x: -3, y: 200, width: 100, height: 50 });
    const other = makeBlocco({ id: "b", x: 0, y: 500, width: 100, height: 50 });
    const result = computeSnap(dragged, -3, 200, [other]);
    expect(result.x).toBe(clamp(result.x, 0, PAGE_W - dragged.width));
  });

  it("SNAP_THRESHOLD e le dimensioni pagina sono quelle attese", () => {
    expect(SNAP_THRESHOLD).toBe(8);
    expect(PAGE_W).toBe(595);
    expect(PAGE_H).toBe(842);
  });
});
