import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableSelection } from "./use-table-selection";

function makeItems(ids: number[]) {
  return ids.map((id) => ({ id }));
}

describe("useTableSelection", () => {
  it("aggiunge e rimuove id singolarmente", () => {
    const items = makeItems([1, 2, 3]);
    const { result } = renderHook(() => useTableSelection({ items }));

    act(() => result.current.toggleSelected(1, true));
    expect(result.current.selectedIds.has(1)).toBe(true);

    act(() => result.current.toggleSelected(1, false));
    expect(result.current.selectedIds.has(1)).toBe(false);
  });

  it("persiste la selezione quando cambiano gli items visibili (cambio pagina)", () => {
    const page1Items = makeItems([1, 2, 3]);
    const page2Items = makeItems([4, 5, 6]);

    const { result, rerender } = renderHook(
      ({ items }) => useTableSelection({ items }),
      { initialProps: { items: page1Items } }
    );

    act(() => result.current.toggleSelected(2, true));
    expect(result.current.selectedIds.has(2)).toBe(true);

    // Navigazione a pagina 2
    rerender({ items: page2Items });
    expect(result.current.selectedIds.has(2)).toBe(true);

    // Selezione di un elemento in pagina 2
    act(() => result.current.toggleSelected(5, true));
    expect(result.current.selectedIds.has(2)).toBe(true);
    expect(result.current.selectedIds.has(5)).toBe(true);
    expect(result.current.selectedIds.size).toBe(2);

    // Ritorno a pagina 1
    rerender({ items: page1Items });
    expect(result.current.selectedIds.has(2)).toBe(true);
    expect(result.current.selectedIds.has(5)).toBe(true);
  });

  it("toggleSelectAll seleziona e deseleziona solo gli elementi visibili senza cancellare altre pagine", () => {
    const page1Items = makeItems([1, 2]);
    const page2Items = makeItems([3, 4]);

    const { result, rerender } = renderHook(
      ({ items }) => useTableSelection({ items }),
      { initialProps: { items: page1Items } }
    );

    // Seleziona pagina 1
    act(() => result.current.toggleSelectAll(true));
    expect(result.current.selectedIds).toEqual(new Set([1, 2]));

    // Passa a pagina 2 e seleziona pagina 2
    rerender({ items: page2Items });
    act(() => result.current.toggleSelectAll(true));
    expect(result.current.selectedIds).toEqual(new Set([1, 2, 3, 4]));

    // Deseleziona pagina 2: gli elementi di pagina 1 restano
    act(() => result.current.toggleSelectAll(false));
    expect(result.current.selectedIds).toEqual(new Set([1, 2]));
  });

  it("clearSelection svuota l'intero set di selezione", () => {
    const items = makeItems([1, 2, 3]);
    const { result } = renderHook(() => useTableSelection({ items }));

    act(() => {
      result.current.toggleSelected(1, true);
      result.current.toggleSelected(2, true);
    });
    expect(result.current.selectedIds.size).toBe(2);

    act(() => result.current.clearSelection());
    expect(result.current.selectedIds.size).toBe(0);
  });
});
