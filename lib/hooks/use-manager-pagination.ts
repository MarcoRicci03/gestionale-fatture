"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

export type UseManagerPaginationOptions = {
  search: string;
  page: number;
  archivedPage: number;
  pageSize: number;
  defaultPageSize: number;
};

export function useManagerPagination({
  search,
  page,
  archivedPage,
  pageSize,
  defaultPageSize,
}: UseManagerPaginationOptions) {
  const router = useRouter();
  const pathname = usePathname();

  // Stesso pattern di latestFiltersRef in InvoicesManager: tiene traccia
  // dello stato più recente verso cui si è navigato, aggiornato
  // sincronamente ad ogni chiamata a navigate() (non solo quando le prop
  // cambiano), per evitare che due navigazioni ravvicinate (es. il flush del
  // debounce di ricerca seguito a ruota da un click di paginazione)
  // leggano entrambe closure stale e la seconda perda silenziosamente la
  // patch della prima.
  const latestListStateRef = useRef({ search, page, archivedPage, pageSize });
  useEffect(() => {
    latestListStateRef.current = { search, page, archivedPage, pageSize };
  }, [search, page, archivedPage, pageSize]);

  function navigate(next: {
    search: string;
    page: number;
    archivedPage: number;
    pageSize: number;
  }) {
    latestListStateRef.current = next;
    const params = new URLSearchParams();
    if (next.search) params.set("q", next.search);
    if (next.page > 1) params.set("page", String(next.page));
    if (next.archivedPage > 1) params.set("archivedPage", String(next.archivedPage));
    if (next.pageSize !== defaultPageSize) params.set("pageSize", String(next.pageSize));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const handleSearchChange = (nextSearch: string) => {
    navigate({ ...latestListStateRef.current, search: nextSearch, page: 1, archivedPage: 1 });
  };

  const handlePageChange = (nextPage: number) => {
    navigate({ ...latestListStateRef.current, page: nextPage });
  };

  const handleArchivedPageChange = (nextArchivedPage: number) => {
    navigate({ ...latestListStateRef.current, archivedPage: nextArchivedPage });
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    navigate({ ...latestListStateRef.current, page: 1, archivedPage: 1, pageSize: nextPageSize });
  };

  return {
    handleSearchChange,
    handlePageChange,
    handleArchivedPageChange,
    handlePageSizeChange,
  };
}
