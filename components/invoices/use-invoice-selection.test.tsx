import { describe, expect, it } from "vitest";
import { renderHook, act, render } from "@testing-library/react";
import { useInvoiceSelection } from "./use-invoice-selection";
import { EMPTY_INVOICE_FILTERS } from "./invoice-filters";
import type { InvoiceFilters } from "./invoice-filters";

function makeInvoices(ids: number[]): { id: number }[] {
  return ids.map((id) => ({ id }));
}

describe("useInvoiceSelection", () => {
  it("toggleSelected aggiunge e rimuove un id dalla selezione", () => {
    const invoices = makeInvoices([1, 2, 3]);
    const { result } = renderHook(() =>
      useInvoiceSelection({ invoices, filters: EMPTY_INVOICE_FILTERS, page: 1 })
    );

    act(() => result.current.toggleSelected(1, true));
    expect(result.current.selectedIds.has(1)).toBe(true);

    act(() => result.current.toggleSelected(1, false));
    expect(result.current.selectedIds.has(1)).toBe(false);
  });

  it("toggleSelectAll seleziona tutte le fatture visibili quando checked è true", () => {
    const invoices = makeInvoices([1, 2, 3]);
    const { result } = renderHook(() =>
      useInvoiceSelection({ invoices, filters: EMPTY_INVOICE_FILTERS, page: 1 })
    );

    act(() => result.current.toggleSelectAll(true));
    expect(Array.from(result.current.selectedIds).sort()).toEqual([1, 2, 3]);
  });

  it("toggleSelectAll deseleziona tutto quando checked è false", () => {
    const invoices = makeInvoices([1, 2, 3]);
    const { result } = renderHook(() =>
      useInvoiceSelection({ invoices, filters: EMPTY_INVOICE_FILTERS, page: 1 })
    );

    act(() => result.current.toggleSelectAll(true));
    act(() => result.current.toggleSelectAll(false));
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("azzera la selezione quando `filters` cambia (reset durante il render)", () => {
    const invoices = makeInvoices([1, 2, 3]);
    const { result, rerender } = renderHook(
      ({ filters, page }: { filters: InvoiceFilters; page: number }) =>
        useInvoiceSelection({ invoices, filters, page }),
      { initialProps: { filters: EMPTY_INVOICE_FILTERS, page: 1 } }
    );

    act(() => result.current.toggleSelected(1, true));
    expect(result.current.selectedIds.has(1)).toBe(true);

    const nextFilters: InvoiceFilters = { ...EMPTY_INVOICE_FILTERS, anno: "2025" };
    rerender({ filters: nextFilters, page: 1 });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("azzera la selezione quando `page` cambia (reset durante il render)", () => {
    const invoices = makeInvoices([1, 2, 3]);
    const { result, rerender } = renderHook(
      ({ filters, page }: { filters: InvoiceFilters; page: number }) =>
        useInvoiceSelection({ invoices, filters, page }),
      { initialProps: { filters: EMPTY_INVOICE_FILTERS, page: 1 } }
    );

    act(() => result.current.toggleSelected(2, true));
    expect(result.current.selectedIds.has(2)).toBe(true);

    rerender({ filters: EMPTY_INVOICE_FILTERS, page: 2 });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("non azzera la selezione se `filters`/`page` restano gli stessi riferimenti", () => {
    const invoices = makeInvoices([1, 2, 3]);
    const { result, rerender } = renderHook(
      ({ filters, page }: { filters: InvoiceFilters; page: number }) =>
        useInvoiceSelection({ invoices, filters, page }),
      { initialProps: { filters: EMPTY_INVOICE_FILTERS, page: 1 } }
    );

    act(() => result.current.toggleSelected(3, true));
    rerender({ filters: EMPTY_INVOICE_FILTERS, page: 1 });
    expect(result.current.selectedIds.has(3)).toBe(true);
  });

  // L'harness sotto renderizza un vero <input ref={selectAllRef}> perché
  // `indeterminate` è una proprietà DOM, non esprimibile via JSX/attributi:
  // serve un componente reale (non renderHook puro) per verificarla.
  function SelectAllHarness({
    invoices,
    filters,
    page,
  }: {
    invoices: { id: number }[];
    filters: InvoiceFilters;
    page: number;
  }) {
    const { selectedIds, selectAllRef, toggleSelected } = useInvoiceSelection({
      invoices,
      filters,
      page,
    });
    return (
      <div>
        <input type="checkbox" ref={selectAllRef} aria-label="select-all" />
        <span data-testid="count">{selectedIds.size}</span>
        {invoices.map((i) => (
          <button
            key={i.id}
            aria-label={`toggle-${i.id}`}
            onClick={() => toggleSelected(i.id, !selectedIds.has(i.id))}
          />
        ))}
      </div>
    );
  }

  it("l'effetto indeterminate diventa true con selezione parziale e false altrimenti", () => {
    const invoices = makeInvoices([1, 2, 3]);
    const { getByLabelText } = render(
      <SelectAllHarness invoices={invoices} filters={EMPTY_INVOICE_FILTERS} page={1} />
    );
    const selectAll = getByLabelText("select-all") as HTMLInputElement;

    expect(selectAll.indeterminate).toBe(false);

    act(() => {
      getByLabelText("toggle-1").click();
    });
    expect(selectAll.indeterminate).toBe(true);

    act(() => {
      getByLabelText("toggle-2").click();
      getByLabelText("toggle-3").click();
    });
    expect(selectAll.indeterminate).toBe(false);
  });
});
