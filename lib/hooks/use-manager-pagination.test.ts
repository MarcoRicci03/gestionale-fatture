import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useManagerPagination } from "./use-manager-pagination";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/patients",
}));

describe("useManagerPagination (DRY-01)", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("handleSearchChange resetta page e archivedPage a 1 e imposta q", () => {
    const { result } = renderHook(() =>
      useManagerPagination({
        search: "",
        page: 3,
        archivedPage: 2,
        pageSize: 20,
        defaultPageSize: 20,
      })
    );

    act(() => {
      result.current.handleSearchChange("Rossi");
    });

    expect(replace).toHaveBeenCalledWith("/patients?q=Rossi", { scroll: false });
  });

  it("handlePageChange mantiene la ricerca e aggiorna la pagina attiva", () => {
    const { result } = renderHook(() =>
      useManagerPagination({
        search: "Rossi",
        page: 1,
        archivedPage: 1,
        pageSize: 20,
        defaultPageSize: 20,
      })
    );

    act(() => {
      result.current.handlePageChange(2);
    });

    expect(replace).toHaveBeenCalledWith("/patients?q=Rossi&page=2", { scroll: false });
  });

  it("handleArchivedPageChange aggiorna archivedPage", () => {
    const { result } = renderHook(() =>
      useManagerPagination({
        search: "",
        page: 1,
        archivedPage: 1,
        pageSize: 20,
        defaultPageSize: 20,
      })
    );

    act(() => {
      result.current.handleArchivedPageChange(3);
    });

    expect(replace).toHaveBeenCalledWith("/patients?archivedPage=3", { scroll: false });
  });

  it("handlePageSizeChange include pageSize se diverso da defaultPageSize e resetta le pagine", () => {
    const { result } = renderHook(() =>
      useManagerPagination({
        search: "Bianchi",
        page: 2,
        archivedPage: 2,
        pageSize: 20,
        defaultPageSize: 20,
      })
    );

    act(() => {
      result.current.handlePageSizeChange(50);
    });

    expect(replace).toHaveBeenCalledWith("/patients?q=Bianchi&pageSize=50", { scroll: false });
  });
});
