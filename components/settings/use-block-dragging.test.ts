import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBlockDragging } from "./use-block-dragging";
import type { Blocco } from "@/lib/pdf/types";

function makeBlocco(overrides: Partial<Blocco> & Pick<Blocco, "id" | "x" | "y">): Blocco {
  return {
    tipo: "testo",
    width: 100,
    height: 50,
    fontSize: 12,
    align: "left",
    visible: true,
    ...overrides,
  };
}

describe("useBlockDragging", () => {
  it("handleDragStart imposta dragging alla posizione corrente del blocco e chiama onDragStart", () => {
    const blocchi = [makeBlocco({ id: "a", x: 10, y: 20 })];
    const onDragStart = vi.fn();
    const { result } = renderHook(() =>
      useBlockDragging({ blocchi, updateBlock: vi.fn(), onDragStart })
    );
    act(() => result.current.handleDragStart("a"));
    expect(result.current.dragging).toEqual({ id: "a", x: 10, y: 20 });
    expect(onDragStart).toHaveBeenCalledWith("a");
  });

  it("handleDragStart con un id inesistente non fa nulla", () => {
    const { result } = renderHook(() =>
      useBlockDragging({ blocchi: [], updateBlock: vi.fn() })
    );
    act(() => result.current.handleDragStart("ghost"));
    expect(result.current.dragging).toBeNull();
  });

  it("handleDrag senza vicini agganciabili imposta la posizione grezza, senza guide", () => {
    const blocchi = [makeBlocco({ id: "a", x: 0, y: 0 })];
    const { result } = renderHook(() =>
      useBlockDragging({ blocchi, updateBlock: vi.fn() })
    );
    act(() => result.current.handleDrag("a", 55, 77));
    expect(result.current.dragging).toEqual({ id: "a", x: 55, y: 77 });
    expect(result.current.guides).toEqual({});
  });

  it("handleDrag aggancia la posizione a un vicino entro soglia (delega a computeSnap)", () => {
    const blocchi = [
      makeBlocco({ id: "a", x: 0, y: 0 }),
      makeBlocco({ id: "b", x: 100, y: 500 }),
    ];
    const { result } = renderHook(() =>
      useBlockDragging({ blocchi, updateBlock: vi.fn() })
    );
    act(() => result.current.handleDrag("a", 103, 0));
    expect(result.current.dragging).toEqual({ id: "a", x: 100, y: 0 });
    expect(result.current.guides).toEqual({ x: 100 });
  });

  it("handleDragStop applica la posizione finale via updateBlock e pulisce dragging/guides", () => {
    const blocchi = [makeBlocco({ id: "a", x: 0, y: 0 })];
    const updateBlock = vi.fn();
    const { result } = renderHook(() =>
      useBlockDragging({ blocchi, updateBlock })
    );
    act(() => result.current.handleDragStart("a"));
    act(() => result.current.handleDrag("a", 42, 43));
    act(() => result.current.handleDragStop("a"));
    expect(updateBlock).toHaveBeenCalledWith("a", { x: 42, y: 43 });
    expect(result.current.dragging).toBeNull();
    expect(result.current.guides).toEqual({});
  });

  it("handleDragStop con un id diverso da quello in dragging non fa nulla", () => {
    const blocchi = [makeBlocco({ id: "a", x: 0, y: 0 })];
    const updateBlock = vi.fn();
    const { result } = renderHook(() =>
      useBlockDragging({ blocchi, updateBlock })
    );
    act(() => result.current.handleDragStart("a"));
    act(() => result.current.handleDragStop("other"));
    expect(updateBlock).not.toHaveBeenCalled();
    expect(result.current.dragging).toEqual({ id: "a", x: 0, y: 0 });
  });
});
