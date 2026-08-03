// components/invoices/use-invoice-filters.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInvoiceFilters } from "./use-invoice-filters";
import { EMPTY_INVOICE_FILTERS } from "./invoice-filters";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/invoices",
}));

describe("useInvoiceFilters", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("handleFiltersChange naviga con f=1, il patch applicato e resetta a page 1", () => {
    const { result } = renderHook(() =>
      useInvoiceFilters({ filters: EMPTY_INVOICE_FILTERS })
    );

    act(() => {
      result.current.handleFiltersChange({ anno: "2025" });
    });

    expect(replace).toHaveBeenCalledWith("/invoices?f=1&anno=2025", {
      scroll: false,
    });
  });

  it("handleReset naviga all'URL nudo (senza f)", () => {
    const { result } = renderHook(() =>
      useInvoiceFilters({
        filters: { ...EMPTY_INVOICE_FILTERS, anno: "2025" },
      })
    );

    act(() => {
      result.current.handleReset();
    });

    expect(replace).toHaveBeenCalledWith("/invoices", { scroll: false });
  });

  it("handlePageChange naviga con i filtri correnti e la nuova pagina", () => {
    const { result } = renderHook(() =>
      useInvoiceFilters({
        filters: { ...EMPTY_INVOICE_FILTERS, anno: "2025" },
      })
    );

    act(() => {
      result.current.handlePageChange(3);
    });

    expect(replace).toHaveBeenCalledWith("/invoices?f=1&anno=2025&page=3", {
      scroll: false,
    });
  });

  it("due cambi filtro ravvicinati senza re-render nel mezzo (RSC round-trip non ancora arrivato): il secondo replace() include ENTRAMBI i patch, non solo l'ultimo", () => {
    // `filters` resta la prop iniziale per tutta la vita dell'hook (nessun
    // rerender con nuove props): simula esattamente lo scenario del bug, in
    // cui il secondo cambio filtro arriva prima che il round-trip RSC del
    // primo abbia aggiornato la prop `filters` del Server Component.
    const { result } = renderHook(() =>
      useInvoiceFilters({ filters: EMPTY_INVOICE_FILTERS })
    );

    act(() => {
      result.current.handleFiltersChange({ anno: "2025" });
    });
    act(() => {
      result.current.handleFiltersChange({ dataDa: "2026-01-01" });
    });

    expect(replace).toHaveBeenCalledTimes(2);
    const secondUrl = (replace.mock.calls[1] as [string, unknown])[0];
    expect(secondUrl).toContain("anno=2025");
    expect(secondUrl).toContain("dataDa=2026-01-01");
  });

  it("la race si estende anche a handlePageChange dopo un handleFiltersChange: il secondo replace() porta comunque il patch di filtro", () => {
    const { result } = renderHook(() =>
      useInvoiceFilters({ filters: EMPTY_INVOICE_FILTERS })
    );

    act(() => {
      result.current.handleFiltersChange({ anno: "2025" });
    });
    act(() => {
      result.current.handlePageChange(2);
    });

    expect(replace).toHaveBeenCalledTimes(2);
    const secondUrl = (replace.mock.calls[1] as [string, unknown])[0];
    expect(secondUrl).toContain("anno=2025");
    expect(secondUrl).toContain("page=2");
  });
});
